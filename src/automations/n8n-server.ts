import type { WorkflowType } from './data';
import { WORKFLOW_TYPE_IDS } from './data';

const DEFAULT_WEBHOOK_PATHS: Record<WorkflowType, string> = {
  'generate-idea-posts': WORKFLOW_TYPE_IDS['generate-idea-posts'],
  'generate-content-post': WORKFLOW_TYPE_IDS['generate-content-post'],
};

const WEBHOOK_PATH_ENV_KEYS: Record<WorkflowType, string> = {
  'generate-idea-posts': 'N8N_GEN_IDEAS_WEBHOOK_PATH',
  'generate-content-post': 'N8N_GEN_CONTENT_WEBHOOK_PATH',
};

export function resolveWebhookPath(type: WorkflowType): string {
  const envKey = WEBHOOK_PATH_ENV_KEYS[type];
  return process.env[envKey] ?? DEFAULT_WEBHOOK_PATHS[type];
}

function resolveWebhookUrl(kind: 'test' | 'production', path: string) {
  const testEnv =
    process.env.N8N_WEBHOOK_TEST_URL ??
    process.env.NEXT_PUBLIC_N8N_WEBHOOK_TEST_URL;
  const prodEnv =
    process.env.N8N_WEBHOOK_PROD_URL ??
    process.env.NEXT_PUBLIC_N8N_WEBHOOK_PROD_URL;
  const baseUrl =
    process.env.N8N_BASE_URL ?? process.env.NEXT_PUBLIC_N8N_BASE_URL;

  if (kind === 'test' && testEnv) return testEnv;
  if (kind === 'production' && prodEnv) return prodEnv;

  const root = (baseUrl ?? 'http://localhost:5678').replace(/\/$/, '');
  const prefix = kind === 'test' ? 'webhook-test' : 'webhook';

  return `${root}/${prefix}/${path}`;
}

export function getN8nWebhookForType(type: WorkflowType) {
  const path = resolveWebhookPath(type);

  return {
    method: 'POST' as const,
    testUrl: resolveWebhookUrl('test', path),
    productionUrl: resolveWebhookUrl('production', path),
    path,
    formField: 'Topic' as const,
  };
}

/** Default webhook URLs khi tạo workflow theo type */
export function getDefaultWebhookConfigForType(type: WorkflowType) {
  const webhook = getN8nWebhookForType(type);
  const useProduction =
    process.env.N8N_USE_PRODUCTION_WEBHOOK === 'true' ||
    process.env.N8N_USE_PRODUCTION_WEBHOOK === '1';

  return {
    useProductionWebhook: useProduction,
    webhookTestUrl: webhook.testUrl,
    webhookProductionUrl: webhook.productionUrl,
  };
}

/** @deprecated Dùng getN8nWebhookForType('generate-idea-posts') */
export const N8N_WEBHOOK = getN8nWebhookForType('generate-idea-posts');

export const N8N_WEBHOOK_DISPLAY = N8N_WEBHOOK;

export function resolveTriggerWebhookUrl(
  type: WorkflowType,
  useProduction: boolean,
  overrides?: { testUrl?: string; productionUrl?: string },
) {
  const custom = useProduction
    ? overrides?.productionUrl?.trim()
    : overrides?.testUrl?.trim();

  if (custom) return custom;

  const webhook = getN8nWebhookForType(type);
  return useProduction ? webhook.productionUrl : webhook.testUrl;
}
