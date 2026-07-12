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
import { getDefaultWebhookConfigForType } from './n8n-server';
import { Workflow, WorkflowDocument } from './schemas/workflow.schema';
import {
  collectCredentialRefs,
  mergeWorkflowConfig,
  toTriggerContext,
  toWorkflowItem,
  type WorkflowTriggerContext,
} from './workflow.mapper';

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
      this.jobModel.find().sort({ createdAt: -1 }).exec(),
    ]);

    const items = workflows.map(toWorkflowItem);
    const workflowIds = new Set(items.map((w) => w.id));

    return {
      workflows: items,
      jobs: jobs
        .map(toAutomationJobItem)
        .filter((job) => !userId || workflowIds.has(job.workflowId)),
    };
  }

  async findAllJobs(
    userId?: string,
    workflowId?: string,
  ): Promise<AutomationJobItem[]> {
    const filter = workflowId?.trim() ? { workflowId: workflowId.trim() } : {};
    const jobs = await this.jobModel
      .find(filter)
      .sort({ createdAt: -1 })
      .exec();

    const items = jobs.map(toAutomationJobItem);
    if (!userId) return items;

    const owned = await this.workflowModel
      .find({ userId })
      .select({ id: 1 })
      .lean()
      .exec();
    const ownedIds = new Set(owned.map((w) => w.id));
    return items.filter((job) => ownedIds.has(job.workflowId));
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

  async create(
    dto: CreateWorkflowDto,
    userId: string,
  ): Promise<WorkflowItem> {
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

  async remove(id: string, userId?: string): Promise<void> {
    await this.findEntityForUser(id, userId);
    await this.workflowModel.deleteOne({ id }).exec();
  }

  async incrementTriggers(id: string): Promise<void> {
    await this.workflowModel.updateOne({ id }, { $inc: { triggers: 1 } }).exec();
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
}

function toAutomationJobItem(doc: AutomationJobDocument): AutomationJobItem {
  const n8n = doc.n8nResponse as AutomationJobItem['n8n'];

  return {
    id: doc.id,
    siteId: doc.siteId ?? null,
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
