import type { UserCredentialItem } from '../credentials/credentials.types';
import type { WorkflowDocument } from './schemas/workflow.schema';
import type { WorkflowNodeCredential } from './schemas/workflow.schema';
import {
  getConfigTopic,
  getDefaultConfigForType,
  type AppId,
  type GenerateContentPostConfig,
  type GenerateIdeaPostsConfig,
  type WorkflowConfig,
  type WorkflowItem,
  type WorkflowNodeCredential as WorkflowNodeCredentialDto,
  type WorkflowType,
} from './data';

export function toWorkflowItem(doc: WorkflowDocument): WorkflowItem {
  const base = {
    id: doc.id,
    userId: doc.userId ?? null,
    siteId: doc.siteId ?? null,
    name: doc.name,
    status: doc.status,
    triggers: doc.triggers,
    updatedAt: doc.updatedAt.toISOString().slice(0, 10),
    lastModified: formatLastModified(doc.updatedAt),
    apps: inferApps(doc),
    nodeCredentials: (doc.nodeCredentials ?? []).map(toNodeCredential),
  };

  const rawConfig = resolveRawConfig(doc);

  if (doc.type === 'generate-idea-posts') {
    return {
      ...base,
      type: 'generate-idea-posts',
      config: normalizeIdeaPostsConfig(rawConfig),
    };
  }

  return {
    ...base,
    type: 'generate-content-post',
    config: normalizeContentPostConfig(rawConfig),
  };
}

/** Ưu tiên `doc.config`; fallback field flat legacy trên document */
function resolveRawConfig(doc: WorkflowDocument): unknown {
  if (doc.config && typeof doc.config === 'object') {
    return doc.config;
  }

  const legacy = doc as WorkflowDocument & {
    topic?: string;
    useProductionWebhook?: boolean;
    webhookTestUrl?: string;
    webhookProductionUrl?: string;
  };

  return {
    topic: legacy.topic,
    useProductionWebhook: legacy.useProductionWebhook,
    webhookTestUrl: legacy.webhookTestUrl,
    webhookProductionUrl: legacy.webhookProductionUrl,
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

/** Collect UserCredential ids được workflow config reference */
export function collectCredentialRefs(config: WorkflowConfig): string[] {
  const ids = [config.googleOAuth.credentialId];

  if ('apiKeyCredentialId' in config) {
    ids.push(config.apiKeyCredentialId);
  }
  if ('wordpressCredentialId' in config) {
    ids.push(config.wordpressCredentialId);
  }

  return ids.filter((id) => id?.trim());
}

function normalizeIdeaPostsConfig(raw: unknown): GenerateIdeaPostsConfig {
  const defaults = getDefaultConfigForType('generate-idea-posts');
  const config = asRecord(raw);

  return {
    topic: stringOr(config.topic, defaults.topic),
    useProductionWebhook: booleanOr(
      config.useProductionWebhook,
      defaults.useProductionWebhook,
    ),
    webhookTestUrl: stringOr(config.webhookTestUrl, defaults.webhookTestUrl),
    webhookProductionUrl: stringOr(
      config.webhookProductionUrl,
      defaults.webhookProductionUrl,
    ),
    googleOAuth: {
      credentialId: stringOr(
        asRecord(config.googleOAuth).credentialId,
        defaults.googleOAuth.credentialId,
      ),
    },
    apiKeyCredentialId: stringOr(
      config.apiKeyCredentialId,
      defaults.apiKeyCredentialId,
    ),
  };
}

function normalizeContentPostConfig(raw: unknown): GenerateContentPostConfig {
  const defaults = getDefaultConfigForType('generate-content-post');
  const config = asRecord(raw);

  return {
    useProductionWebhook: booleanOr(
      config.useProductionWebhook,
      defaults.useProductionWebhook,
    ),
    webhookTestUrl: stringOr(config.webhookTestUrl, defaults.webhookTestUrl),
    webhookProductionUrl: stringOr(
      config.webhookProductionUrl,
      defaults.webhookProductionUrl,
    ),
    googleOAuth: {
      credentialId: stringOr(
        asRecord(config.googleOAuth).credentialId,
        defaults.googleOAuth.credentialId,
      ),
    },
    wordpressCredentialId: stringOr(
      config.wordpressCredentialId,
      defaults.wordpressCredentialId,
    ),
  };
}

function inferApps(doc: WorkflowDocument): AppId[] {
  const apps = new Set<AppId>();
  const config = asRecord(doc.config);

  if (asRecord(config.googleOAuth).credentialId) {
    apps.add('google');
  }

  for (const node of doc.nodeCredentials ?? []) {
    switch (node.nodeTypeId) {
      case 'gemini-model':
      case 'google-sheet':
      case 'add-to-sheet':
        apps.add('google');
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

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export type WorkflowTriggerContext = {
  workflowId: string;
  workflowType: WorkflowType;
  userId: string | null;
  siteId: string | null;
  topic: string;
  config: WorkflowConfig;
  nodeCredentials: WorkflowNodeCredentialDto[];
  /** Credentials đã resolve từ user_credentials theo refs trong config */
  resolvedCredentials: UserCredentialItem[];
};

export function toTriggerContext(
  doc: WorkflowDocument,
  topicOverride?: string,
  resolvedCredentials: UserCredentialItem[] = [],
): WorkflowTriggerContext {
  const item = toWorkflowItem(doc);

  return {
    workflowId: item.id,
    workflowType: item.type,
    userId: item.userId,
    siteId: item.siteId,
    topic: topicOverride?.trim() || getConfigTopic(item.config),
    config: item.config,
    nodeCredentials: item.nodeCredentials,
    resolvedCredentials,
  };
}

/** Merge patch vào config hiện tại theo type — giữ field không gửi lên */
export function mergeWorkflowConfig(
  type: WorkflowType,
  current: unknown,
  patch: Partial<{
    topic: string;
    useProductionWebhook: boolean;
    webhookTestUrl: string;
    webhookProductionUrl: string;
    googleOAuth: { credentialId: string };
    apiKeyCredentialId: string;
    wordpressCredentialId: string;
  }>,
): WorkflowConfig {
  if (type === 'generate-idea-posts') {
    const base = normalizeIdeaPostsConfig(current);
    return {
      ...base,
      ...(patch.topic !== undefined ? { topic: patch.topic } : {}),
      ...(patch.useProductionWebhook !== undefined
        ? { useProductionWebhook: patch.useProductionWebhook }
        : {}),
      ...(patch.webhookTestUrl !== undefined
        ? { webhookTestUrl: patch.webhookTestUrl }
        : {}),
      ...(patch.webhookProductionUrl !== undefined
        ? { webhookProductionUrl: patch.webhookProductionUrl }
        : {}),
      ...(patch.apiKeyCredentialId !== undefined
        ? { apiKeyCredentialId: patch.apiKeyCredentialId }
        : {}),
      googleOAuth: patch.googleOAuth
        ? {
            credentialId:
              patch.googleOAuth.credentialId ?? base.googleOAuth.credentialId,
          }
        : base.googleOAuth,
    };
  }

  const base = normalizeContentPostConfig(current);
  return {
    ...base,
    ...(patch.useProductionWebhook !== undefined
      ? { useProductionWebhook: patch.useProductionWebhook }
      : {}),
    ...(patch.webhookTestUrl !== undefined
      ? { webhookTestUrl: patch.webhookTestUrl }
      : {}),
    ...(patch.webhookProductionUrl !== undefined
      ? { webhookProductionUrl: patch.webhookProductionUrl }
      : {}),
    ...(patch.wordpressCredentialId !== undefined
      ? { wordpressCredentialId: patch.wordpressCredentialId }
      : {}),
    googleOAuth: patch.googleOAuth
      ? {
          credentialId:
            patch.googleOAuth.credentialId ?? base.googleOAuth.credentialId,
        }
      : base.googleOAuth,
  };
}
