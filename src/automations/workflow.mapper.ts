import type { WorkflowDocument } from './schemas/workflow.schema';
import type { WorkflowNodeCredential } from './schemas/workflow.schema';
import type {
  AppId,
  WorkflowConfig,
  WorkflowItem,
  WorkflowNodeCredential as WorkflowNodeCredentialDto,
  WorkflowType,
} from './data';

export function toWorkflowItem(doc: WorkflowDocument): WorkflowItem {
  return {
    id: doc.id,
    siteId: doc.siteId ?? null,
    name: doc.name,
    type: doc.type,
    status: doc.status,
    triggers: doc.triggers,
    updatedAt: doc.updatedAt.toISOString().slice(0, 10),
    lastModified: formatLastModified(doc.updatedAt),
    apps: inferApps(doc.nodeCredentials ?? []),
    config: {
      topic: doc.topic,
      useProductionWebhook: doc.useProductionWebhook,
      webhookTestUrl: doc.webhookTestUrl,
      webhookProductionUrl: doc.webhookProductionUrl,
    },
    nodeCredentials: (doc.nodeCredentials ?? []).map(toNodeCredential),
  };
}

export function toNodeCredential(
  node: WorkflowNodeCredential,
): WorkflowNodeCredentialDto {
  return {
    id: node.id,
    nodeTypeId: node.nodeTypeId,
    credentialId: node.credentialId,
    config: node.config ?? undefined,
  };
}

function inferApps(nodes: WorkflowNodeCredential[]): AppId[] {
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
  nodeCredentials: WorkflowNodeCredentialDto[];
};

export function toTriggerContext(
  doc: WorkflowDocument,
  topicOverride?: string,
): WorkflowTriggerContext {
  const item = toWorkflowItem(doc);

  return {
    workflowId: item.id,
    workflowType: item.type,
    siteId: item.siteId,
    topic: topicOverride?.trim() || item.config.topic,
    config: item.config,
    nodeCredentials: item.nodeCredentials,
  };
}
