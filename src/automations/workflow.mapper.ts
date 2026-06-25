import type { WorkflowEntity } from './entities/workflow.entity';
import type { WorkflowNodeCredentialEntity } from './entities/workflow-node-credential.entity';
import type {
  AppId,
  WorkflowConfig,
  WorkflowItem,
  WorkflowNodeCredential,
  WorkflowType,
} from './data';

export function toWorkflowItem(entity: WorkflowEntity): WorkflowItem {
  return {
    id: entity.id,
    siteId: entity.siteId,
    name: entity.name,
    type: entity.type,
    status: entity.status,
    triggers: entity.triggers,
    updatedAt: entity.updatedAt.toISOString().slice(0, 10),
    lastModified: formatLastModified(entity.updatedAt),
    apps: inferApps(entity.nodeCredentials ?? []),
    config: {
      topic: entity.topic,
      useProductionWebhook: entity.useProductionWebhook,
      webhookTestUrl: entity.webhookTestUrl,
      webhookProductionUrl: entity.webhookProductionUrl,
    },
    nodeCredentials: (entity.nodeCredentials ?? []).map(toNodeCredential),
  };
}

export function toNodeCredential(
  entity: WorkflowNodeCredentialEntity,
): WorkflowNodeCredential {
  return {
    id: entity.id,
    nodeTypeId: entity.nodeTypeId,
    credentialId: entity.credentialId,
    config: entity.config ?? undefined,
  };
}

function inferApps(nodes: WorkflowNodeCredentialEntity[]): AppId[] {
  const apps = new Set<AppId>();

  for (const node of nodes) {
    switch (node.nodeTypeId) {
      case 'gemini-model':
      case 'google-sheet':
      case 'add-to-sheet':
        apps.add('google');
        break;
      case 'openrouter-model':
      case 'openai':
        break;
      default:
        break;
    }
  }

  return [...apps];
}

function formatLastModified(date: Date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export type WorkflowTriggerContext = {
  workflowId: string;
  workflowType: WorkflowType;
  siteId: string | null;
  topic: string;
  config: WorkflowConfig;
  nodeCredentials: WorkflowNodeCredential[];
};

export function toTriggerContext(
  entity: WorkflowEntity,
  topicOverride?: string,
): WorkflowTriggerContext {
  const item = toWorkflowItem(entity);

  return {
    workflowId: item.id,
    workflowType: item.type,
    siteId: item.siteId,
    topic: topicOverride?.trim() || item.config.topic,
    config: item.config,
    nodeCredentials: item.nodeCredentials,
  };
}
