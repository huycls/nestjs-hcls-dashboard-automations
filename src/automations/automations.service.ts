import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { DEFAULT_WORKFLOW_CONFIG, WORKFLOW_TYPES } from './data';
import type { WorkflowItem } from './data';
import type { CreateWorkflowDto } from './dto/create-workflow.dto';
import type { UpdateWorkflowDto } from './dto/update-workflow.dto';
import type { UpdateWorkflowConfigDto } from './dto/update-workflow-config.dto';
import type { UpsertNodeCredentialDto } from './dto/upsert-node-credential.dto';
import { getDefaultWebhookConfigForType } from './n8n-server';
import { WorkflowEntity } from './entities/workflow.entity';
import { WorkflowNodeCredentialEntity } from './entities/workflow-node-credential.entity';
import {
  toTriggerContext,
  toWorkflowItem,
  type WorkflowTriggerContext,
} from './workflow.mapper';

@Injectable()
export class AutomationsService {
  constructor(
    @InjectRepository(WorkflowEntity)
    private readonly workflowRepo: Repository<WorkflowEntity>,
    @InjectRepository(WorkflowNodeCredentialEntity)
    private readonly nodeCredentialRepo: Repository<WorkflowNodeCredentialEntity>,
  ) {}

  async findAll(): Promise<WorkflowItem[]> {
    const workflows = await this.workflowRepo.find({
      order: { updatedAt: 'DESC' },
    });

    return workflows.map(toWorkflowItem);
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
    const workflow = await this.workflowRepo.findOne({ where: { siteId } });

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

    const workflow = this.workflowRepo.create({
      id: `wf-${randomUUID()}`,
      siteId: dto.siteId?.trim() || null,
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
    });

    const saved = await this.workflowRepo.save(workflow);

    if (dto.nodeCredentials?.length) {
      await this.upsertNodeCredentials(saved.id, dto.nodeCredentials);
      return this.findOne(saved.id);
    }

    return toWorkflowItem(saved);
  }

  async update(id: string, dto: UpdateWorkflowDto): Promise<WorkflowItem> {
    const workflow = await this.findEntity(id);

    if (dto.name !== undefined) {
      workflow.name = dto.name.trim();
    }

    if (dto.status !== undefined) {
      workflow.status = dto.status;
    }

    await this.workflowRepo.save(workflow);
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

    await this.workflowRepo.save(workflow);
    return this.findOne(id);
  }

  async upsertNodeCredentials(
    workflowId: string,
    nodes: UpsertNodeCredentialDto[],
  ): Promise<WorkflowItem> {
    await this.findEntity(workflowId);

    for (const node of nodes) {
      const existing = await this.nodeCredentialRepo.findOne({
        where: { workflowId, nodeTypeId: node.nodeTypeId },
      });

      await this.nodeCredentialRepo.save({
        id: existing?.id ?? `nc-${randomUUID()}`,
        workflowId,
        nodeTypeId: node.nodeTypeId,
        credentialId: node.credentialId,
        config: node.config ?? null,
      });
    }

    return this.findOne(workflowId);
  }

  async remove(id: string): Promise<void> {
    await this.findEntity(id);
    await this.workflowRepo.delete({ id });
  }

  async incrementTriggers(id: string): Promise<void> {
    const workflow = await this.findEntity(id);
    workflow.triggers += 1;
    await this.workflowRepo.save(workflow);
  }

  async markAsRunning(id: string): Promise<WorkflowItem> {
    const workflow = await this.findEntity(id);

    if (workflow.status !== 'Running') {
      workflow.statusBeforeRun = workflow.status;
    }

    workflow.status = 'Running';
    await this.workflowRepo.save(workflow);
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
    await this.workflowRepo.save(workflow);
    return this.findOne(id);
  }

  private async findEntity(id: string): Promise<WorkflowEntity> {
    const workflow = await this.workflowRepo.findOne({ where: { id } });

    if (!workflow) {
      throw new NotFoundException(`Workflow ${id} not found`);
    }

    return workflow;
  }
}
