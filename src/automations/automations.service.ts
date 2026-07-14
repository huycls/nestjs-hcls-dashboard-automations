import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import { Model } from 'mongoose';
import { CredentialsService } from '../credentials/credentials.service';
import type { UserCredentialItem } from '../credentials/credentials.types';
import {
  AutomationJob,
  AutomationJobDocument,
} from '../jobs/schemas/automation-job.schema';
import { getDefaultConfigForType, WORKFLOW_TYPES } from './data';
import type {
  AutomationJobItem,
  AutomationsListResponse,
  WorkflowItem,
} from './data';
import type { CreateWorkflowDto } from './dto/create-workflow.dto';
import type { UpdateWorkflowDto } from './dto/update-workflow.dto';
import type { UpdateWorkflowConfigDto } from './dto/update-workflow-config.dto';
import type { UpsertNodeCredentialDto } from './dto/upsert-node-credential.dto';
import type { UpdateNodeConfigDto } from './dto/update-node-config.dto';
import { getDefaultWebhookConfigForType } from './n8n-server';
import { Workflow, WorkflowDocument } from './schemas/workflow.schema';
import {
  collectCredentialRefs,
  mergeWorkflowConfig,
  toTriggerContext,
  toUiCredentials,
  toWorkflowItem,
  type WorkflowTriggerContext,
} from './workflow.mapper';
import type { NodeTypeId } from './data';

@Injectable()
export class AutomationsService implements OnModuleInit {
  constructor(
    @InjectModel(Workflow.name)
    private readonly workflowModel: Model<WorkflowDocument>,
    @InjectModel(AutomationJob.name)
    private readonly jobModel: Model<AutomationJobDocument>,
    private readonly credentialsService: CredentialsService,
  ) {}

  /** Sparse unique index bỏ qua field absent — không phải null */
  async onModuleInit() {
    await Promise.all([
      this.workflowModel
        .updateMany({ siteId: null }, { $unset: { siteId: 1 } })
        .exec(),
      this.jobModel
        .updateMany({ siteId: null }, { $unset: { siteId: 1 } })
        .exec(),
    ]);
  }

  async findAll(userId?: string): Promise<AutomationsListResponse> {
    const workflowFilter = userId ? { userId } : {};
    const [workflows, jobs] = await Promise.all([
      this.workflowModel.find(workflowFilter).sort({ updatedAt: -1 }).exec(),
      this.findJobsForUser(userId),
    ]);

    return {
      workflows: workflows.map(toWorkflowItem),
      jobs: jobs.map(toAutomationJobItem),
    };
  }

  async findAllJobs(
    userId?: string,
    workflowId?: string,
  ): Promise<AutomationJobItem[]> {
    const jobs = await this.findJobsForUser(userId, workflowId);
    return jobs.map(toAutomationJobItem);
  }

  async findOne(id: string, userId?: string): Promise<WorkflowItem> {
    const workflow = await this.findEntityForUser(id, userId);
    return toWorkflowItem(workflow);
  }

  async resolveForTrigger(
    workflowId: string,
    topicOverride?: string,
    userId?: string,
  ): Promise<WorkflowTriggerContext> {
    const workflow = await this.findEntityForUser(workflowId, userId);
    return this.buildTriggerContext(workflow, topicOverride);
  }

  async resolveBySiteId(
    siteId: string,
    topicOverride?: string,
  ): Promise<WorkflowTriggerContext> {
    const workflow = await this.workflowModel.findOne({ siteId }).exec();

    if (!workflow) {
      throw new NotFoundException(`Site ${siteId} not found`);
    }

    return this.buildTriggerContext(workflow, topicOverride);
  }

  async create(dto: CreateWorkflowDto, userId: string): Promise<WorkflowItem> {
    const type = dto.type?.trim() as CreateWorkflowDto['type'];

    if (!WORKFLOW_TYPES.some((item) => item.id === type)) {
      throw new BadRequestException(`Invalid workflow type: ${dto.type}`);
    }

    const webhookDefaults = getDefaultWebhookConfigForType(type);
    const config = mergeWorkflowConfig(type, getDefaultConfigForType(type), {
      ...dto.config,
      useProductionWebhook:
        dto.config?.useProductionWebhook ??
        webhookDefaults.useProductionWebhook,
      webhookTestUrl:
        dto.config?.webhookTestUrl ?? webhookDefaults.webhookTestUrl,
      webhookProductionUrl:
        dto.config?.webhookProductionUrl ??
        webhookDefaults.webhookProductionUrl,
    });

    await this.assertCredentialRefsOwnedByUser(userId, config);

    const siteId = dto.siteId?.trim();
    const workflow = await this.workflowModel.create({
      id: `wf-${randomUUID()}`,
      userId,
      ...(siteId ? { siteId } : {}),
      name: dto.name.trim(),
      type,
      status: 'Draft',
      triggers: 0,
      config,
      nodeCredentials: [],
      credentials: {
        openRouterApiKey: '',
        model: '',
        spreadsheetId: '',
      },
    });

    if (dto.nodeCredentials?.length) {
      await this.upsertNodeCredentials(
        workflow.id,
        dto.nodeCredentials,
        userId,
      );
      return this.findOne(workflow.id, userId);
    }

    return toWorkflowItem(workflow);
  }

  async update(
    id: string,
    dto: UpdateWorkflowDto,
    userId?: string,
  ): Promise<WorkflowItem> {
    const workflow = await this.findEntityForUser(id, userId);

    if (dto.name !== undefined) {
      workflow.name = dto.name.trim();
    }

    if (dto.status !== undefined) {
      workflow.status = dto.status;
    }

    await workflow.save();
    return this.findOne(id, userId);
  }

  async updateConfig(
    id: string,
    config: UpdateWorkflowConfigDto,
    userId?: string,
  ): Promise<WorkflowItem> {
    const workflow = await this.findEntityForUser(id, userId);
    const current = toWorkflowItem(workflow).config;
    const next = mergeWorkflowConfig(workflow.type, current, config);

    const ownerId = userId ?? workflow.userId;
    if (ownerId) {
      await this.assertCredentialRefsOwnedByUser(ownerId, next);
    }

    workflow.config = next;
    workflow.markModified('config');

    await workflow.save();
    return this.findOne(id, userId);
  }

  async upsertNodeCredentials(
    workflowId: string,
    nodes: UpsertNodeCredentialDto[],
    userId?: string,
  ): Promise<WorkflowItem> {
    const workflow = await this.findEntityForUser(workflowId, userId);

    for (const node of nodes) {
      const existingIndex = workflow.nodeCredentials.findIndex(
        (item) => item.nodeTypeId === node.nodeTypeId,
      );

      const credential = {
        id:
          existingIndex >= 0
            ? workflow.nodeCredentials[existingIndex].id
            : `nc-${randomUUID()}`,
        nodeTypeId: node.nodeTypeId,
        credentialId: node.credentialId,
        config: node.config ?? undefined,
      };

      if (existingIndex >= 0) {
        workflow.nodeCredentials[existingIndex] = credential;
      } else {
        workflow.nodeCredentials.push(credential);
      }
    }

    workflow.markModified('nodeCredentials');
    await workflow.save();
    return this.findOne(workflowId, userId);
  }

  /**
   * Save FE node config (topic + Approach C credentials).
   * Also mirrors into nodeCredentials.config so n8n payload stays in sync.
   */
  async updateNodeConfig(
    workflowId: string,
    dto: UpdateNodeConfigDto,
  ): Promise<WorkflowItem> {
    const workflow = await this.findEntity(workflowId);

    if (!dto.credentials || typeof dto.credentials !== 'object') {
      throw new BadRequestException('credentials is required');
    }

    const credentials = toUiCredentials(dto.credentials);

    if (dto.topic !== undefined) {
      const current = toWorkflowItem(workflow).config;
      workflow.config = mergeWorkflowConfig(workflow.type, current, {
        topic: dto.topic.trim(),
      });
      workflow.markModified('config');
    }

    workflow.credentials = credentials;
    workflow.markModified('credentials');

    const openRouterConfig = {
      apiKey: credentials.openRouterApiKey,
      model: credentials.model,
    };
    const sheetConfig = credentials.spreadsheetId
      ? { spreadsheetId: credentials.spreadsheetId }
      : undefined;

    this.upsertNodeCredentialLocal(
      workflow,
      'openrouter-model',
      'ui-openrouter',
      openRouterConfig,
    );
    this.upsertNodeCredentialLocal(
      workflow,
      'gemini-model',
      'ui-openrouter',
      openRouterConfig,
    );
    this.upsertNodeCredentialLocal(
      workflow,
      'add-to-sheet',
      'ui-google',
      sheetConfig,
    );
    this.upsertNodeCredentialLocal(
      workflow,
      'google-sheet',
      'ui-google',
      sheetConfig,
    );

    workflow.markModified('nodeCredentials');
    await workflow.save();
    return this.findOne(workflowId);
  }

  private upsertNodeCredentialLocal(
    workflow: WorkflowDocument,
    nodeTypeId: NodeTypeId,
    credentialId: string,
    config?: Record<string, string>,
  ) {
    const existingIndex = workflow.nodeCredentials.findIndex(
      (item) => item.nodeTypeId === nodeTypeId,
    );

    const credential = {
      id:
        existingIndex >= 0
          ? workflow.nodeCredentials[existingIndex].id
          : `nc-${randomUUID()}`,
      nodeTypeId,
      credentialId,
      config,
    };

    if (existingIndex >= 0) {
      workflow.nodeCredentials[existingIndex] = credential;
    } else {
      workflow.nodeCredentials.push(credential);
    }
  }

  async remove(id: string): Promise<void> {
    await this.findEntity(id);
    await this.workflowModel.deleteOne({ id }).exec();
  }

  async incrementTriggers(id: string): Promise<void> {
    await this.workflowModel
      .updateOne({ id }, { $inc: { triggers: 1 } })
      .exec();
  }

  async markAsRunning(id: string): Promise<WorkflowItem> {
    const workflow = await this.findEntity(id);

    if (workflow.status !== 'Running') {
      workflow.statusBeforeRun = workflow.status;
    }

    workflow.status = 'Running';
    await workflow.save();
    return this.findOne(id);
  }

  async markRunFinished(
    id: string,
    outcome: 'completed' | 'failed',
  ): Promise<WorkflowItem> {
    const workflow = await this.findEntity(id);

    if (outcome === 'completed') {
      workflow.status = workflow.statusBeforeRun ?? 'Active';
    } else {
      workflow.status = 'Failed';
    }

    workflow.statusBeforeRun = null;
    await workflow.save();
    return this.findOne(id);
  }

  private async buildTriggerContext(
    workflow: WorkflowDocument,
    topicOverride?: string,
  ): Promise<WorkflowTriggerContext> {
    const item = toWorkflowItem(workflow);
    const refs = collectCredentialRefs(item.config);
    const ownerId = workflow.userId;

    let resolvedCredentials: UserCredentialItem[] = [];

    if (ownerId && refs.length > 0) {
      const map = await this.credentialsService.resolveForUser(ownerId, refs);
      resolvedCredentials = [...map.values()];
    }

    return toTriggerContext(workflow, topicOverride, resolvedCredentials);
  }

  private async assertCredentialRefsOwnedByUser(
    userId: string,
    config: ReturnType<typeof mergeWorkflowConfig>,
  ) {
    const refs = collectCredentialRefs(config);
    if (refs.length === 0) return;
    await this.credentialsService.resolveForUser(userId, refs);
  }

  private async findEntityForUser(
    id: string,
    userId?: string,
  ): Promise<WorkflowDocument> {
    const workflow = await this.findEntity(id);

    if (userId && workflow.userId && workflow.userId !== userId) {
      throw new ForbiddenException(`Workflow ${id} does not belong to user`);
    }

    return workflow;
  }

  private async findEntity(id: string): Promise<WorkflowDocument> {
    const workflow = await this.workflowModel.findOne({ id }).exec();

    if (!workflow) {
      throw new NotFoundException(`Workflow ${id} not found`);
    }

    return workflow;
  }

  /**
   * Jobs của user: ưu tiên filter userId denormalized;
   * legacy jobs (chưa có userId) lấy qua owned workflowIds.
   */
  private async findJobsForUser(userId?: string, workflowId?: string) {
    const scopedWorkflowId = workflowId?.trim() || undefined;

    if (!userId) {
      const filter = scopedWorkflowId ? { workflowId: scopedWorkflowId } : {};
      return this.jobModel.find(filter).sort({ createdAt: -1 }).exec();
    }

    const owned = await this.workflowModel
      .find({ userId })
      .select({ id: 1 })
      .lean()
      .exec();
    const ownedIds = owned.map((w) => w.id);

    const filter: Record<string, unknown> = {
      $or: [
        { userId },
        {
          workflowId: { $in: ownedIds },
          $or: [{ userId: null }, { userId: { $exists: false } }],
        },
      ],
    };

    if (scopedWorkflowId) {
      filter.workflowId = scopedWorkflowId;
    }

    return this.jobModel.find(filter).sort({ createdAt: -1 }).exec();
  }
}

function toAutomationJobItem(doc: AutomationJobDocument): AutomationJobItem {
  const n8n = doc.n8nResponse as AutomationJobItem['n8n'];

  return {
    id: doc.id,
    siteId: doc.siteId ?? null,
    userId: doc.userId ?? null,
    workflowId: doc.workflowId,
    topic: doc.topic,
    status: doc.status,
    errorMessage: doc.errorMessage,
    n8n: n8n ?? null,
    completedAt: doc.completedAt?.toISOString() ?? null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
