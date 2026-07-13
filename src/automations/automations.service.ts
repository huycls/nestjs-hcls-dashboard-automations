import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import { Model } from 'mongoose';
import {
  AutomationJob,
  AutomationJobDocument,
} from '../jobs/schemas/automation-job.schema';
import { DEFAULT_WORKFLOW_CONFIG, WORKFLOW_TYPES } from './data';
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

  async findAll(): Promise<AutomationsListResponse> {
    const [workflows, jobs] = await Promise.all([
      this.workflowModel.find().sort({ updatedAt: -1 }).exec(),
      this.jobModel.find().sort({ createdAt: -1 }).exec(),
    ]);

    return {
      workflows: workflows.map(toWorkflowItem),
      jobs: jobs.map(toAutomationJobItem),
    };
  }

  async findAllJobs(workflowId?: string): Promise<AutomationJobItem[]> {
    const filter = workflowId?.trim() ? { workflowId: workflowId.trim() } : {};
    const jobs = await this.jobModel
      .find(filter)
      .sort({ createdAt: -1 })
      .exec();

    return jobs.map(toAutomationJobItem);
  }

  async findOne(id: string): Promise<WorkflowItem> {
    const workflow = await this.findEntity(id);
    return toWorkflowItem(workflow);
  }

  async resolveForTrigger(
    workflowId: string,
    topicOverride?: string,
  ): Promise<WorkflowTriggerContext> {
    const workflow = await this.findEntity(workflowId);
    return toTriggerContext(workflow, topicOverride);
  }

  async resolveBySiteId(
    siteId: string,
    topicOverride?: string,
  ): Promise<WorkflowTriggerContext> {
    const workflow = await this.workflowModel.findOne({ siteId }).exec();

    if (!workflow) {
      throw new NotFoundException(`Site ${siteId} not found`);
    }

    return toTriggerContext(workflow, topicOverride);
  }

  async create(dto: CreateWorkflowDto): Promise<WorkflowItem> {
    const type = dto.type?.trim() as CreateWorkflowDto['type'];

    if (!WORKFLOW_TYPES.some((item) => item.id === type)) {
      throw new BadRequestException(`Invalid workflow type: ${dto.type}`);
    }

    const webhookDefaults = getDefaultWebhookConfigForType(type);

    const siteId = dto.siteId?.trim();
    const workflow = await this.workflowModel.create({
      id: `wf-${randomUUID()}`,
      ...(siteId ? { siteId } : {}),
      name: dto.name.trim(),
      type,
      status: 'Draft',
      triggers: 0,
      topic: dto.config?.topic ?? DEFAULT_WORKFLOW_CONFIG.topic,
      useProductionWebhook:
        dto.config?.useProductionWebhook ??
        webhookDefaults.useProductionWebhook,
      webhookTestUrl:
        dto.config?.webhookTestUrl ?? webhookDefaults.webhookTestUrl,
      webhookProductionUrl:
        dto.config?.webhookProductionUrl ??
        webhookDefaults.webhookProductionUrl,
      nodeCredentials: [],
      credentials: {
        openRouterApiKey: '',
        model: '',
        spreadsheetId: '',
      },
    });

    if (dto.nodeCredentials?.length) {
      await this.upsertNodeCredentials(workflow.id, dto.nodeCredentials);
      return this.findOne(workflow.id);
    }

    return toWorkflowItem(workflow);
  }

  async update(id: string, dto: UpdateWorkflowDto): Promise<WorkflowItem> {
    const workflow = await this.findEntity(id);

    if (dto.name !== undefined) {
      workflow.name = dto.name.trim();
    }

    if (dto.status !== undefined) {
      workflow.status = dto.status;
    }

    await workflow.save();
    return this.findOne(id);
  }

  async updateConfig(
    id: string,
    config: UpdateWorkflowConfigDto,
  ): Promise<WorkflowItem> {
    const workflow = await this.findEntity(id);

    if (config.topic !== undefined) workflow.topic = config.topic;
    if (config.useProductionWebhook !== undefined) {
      workflow.useProductionWebhook = config.useProductionWebhook;
    }
    if (config.webhookTestUrl !== undefined) {
      workflow.webhookTestUrl = config.webhookTestUrl;
    }
    if (config.webhookProductionUrl !== undefined) {
      workflow.webhookProductionUrl = config.webhookProductionUrl;
    }

    await workflow.save();
    return this.findOne(id);
  }

  async upsertNodeCredentials(
    workflowId: string,
    nodes: UpsertNodeCredentialDto[],
  ): Promise<WorkflowItem> {
    const workflow = await this.findEntity(workflowId);

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
    return this.findOne(workflowId);
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
      workflow.topic = dto.topic.trim();
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

    this.upsertNodeCredentialLocal(workflow, 'openrouter-model', 'ui-openrouter', openRouterConfig);
    this.upsertNodeCredentialLocal(workflow, 'gemini-model', 'ui-openrouter', openRouterConfig);
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
