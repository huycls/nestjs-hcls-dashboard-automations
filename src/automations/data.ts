import type { JobStatus } from '../jobs/jobs.constants';

export type AppId =
  | 'notion'
  | 'trello'
  | 'google'
  | 'discord'
  | 'slack'
  | 'dropbox'
  | 'stripe'
  | 'hubspot'
  | 'mailchimp'
  | 'zendesk';

export type WorkflowStatus =
  | 'Active'
  | 'Paused'
  | 'Draft'
  | 'Running'
  | 'Failed';

export const WORKFLOW_STATUS_LABELS: Record<WorkflowStatus, string> = {
  Active: 'Active',
  Paused: 'Paused',
  Draft: 'Draft',
  Running: 'Đang thực hiện',
  Failed: 'Thất bại',
};

export type WorkflowType = 'generate-idea-posts' | 'generate-content-post';

/** Node type id — map 1-1 với node configurable trong n8n workflow */
export type NodeTypeId =
  | 'webhook'
  | 'gemini-model'
  | 'openrouter-model'
  | 'openai'
  | 'google-sheet'
  | 'add-to-sheet';

export const NODE_TYPE_IDS: NodeTypeId[] = [
  'webhook',
  'gemini-model',
  'openrouter-model',
  'openai',
  'google-sheet',
  'add-to-sheet',
];

/** n8n webhook path theo workflow type */
export const WORKFLOW_TYPE_IDS: Record<WorkflowType, string> = {
  'generate-idea-posts': 'tJzVZLs9LEmdR6WH',
  'generate-content-post': 'ZEMDqJJ0egeGO4FQ',
};

export const WORKFLOW_TYPES: Array<{
  id: WorkflowType;
  typeId: string;
  title: string;
  description: string;
}> = [
  {
    id: 'generate-idea-posts',
    typeId: WORKFLOW_TYPE_IDS['generate-idea-posts'],
    title: 'Generate Idea Posts',
    description: 'Brainstorm and generate post ideas for your social channels.',
  },
  {
    id: 'generate-content-post',
    typeId: WORKFLOW_TYPE_IDS['generate-content-post'],
    title: 'Generate Content Post',
    description: 'Create full content posts ready to publish across platforms.',
  },
];

export const WORKFLOW_TYPE_LABELS: Record<WorkflowType, string> = {
  'generate-idea-posts': 'Generate Idea Posts',
  'generate-content-post': 'Generate Content Post',
};

/** Chỉ generate-idea-posts cần Topic khi trigger n8n */
export function workflowRequiresTopic(type: WorkflowType): boolean {
  return type === 'generate-idea-posts';
}

/** --- Config theo workflow type (hybrid: credential ref + WP siteUrl) --- */

export type WorkflowWebhookConfig = {
  useProductionWebhook: boolean;
  webhookTestUrl: string;
  webhookProductionUrl: string;
};

/** Google OAuth — ref tới UserCredential.id (type: google-oauth) */
export type GoogleOAuthConfig = {
  credentialId: string;
};

/** generate-idea-posts: Google OAuth + API key (refs tới user credentials) */
export type GenerateIdeaPostsConfig = WorkflowWebhookConfig & {
  topic: string;
  googleOAuth: GoogleOAuthConfig;
  /** Ref → UserCredential.id (type: api-key) */
  apiKeyCredentialId: string;
};

/** generate-content-post: Google OAuth + WordPress credential ref */
export type GenerateContentPostConfig = WorkflowWebhookConfig & {
  googleOAuth: GoogleOAuthConfig;
  /** Ref → UserCredential.id (type: wordpress) */
  wordpressCredentialId: string;
};

export type WorkflowConfigByType = {
  'generate-idea-posts': GenerateIdeaPostsConfig;
  'generate-content-post': GenerateContentPostConfig;
};

export type WorkflowConfig = WorkflowConfigByType[WorkflowType];

export type WorkflowNodeCredential = {
  id: string;
  nodeTypeId: NodeTypeId;
  credentialId: string;
  config?: Record<string, string>;
};

/** Shared credentials from FE node config (Approach C) */
export type WorkflowUiCredentials = {
  openRouterApiKey: string;
  model: string;
  spreadsheetId: string;
};

export const DEFAULT_WORKFLOW_UI_CREDENTIALS: WorkflowUiCredentials = {
  openRouterApiKey: '',
  model: '',
  spreadsheetId: '',
};

export type JobSettings = {
  model: string;
  spreadsheetId: string;
};

export type JobCredentialRefs = {
  apiKeyCredentialId?: string;
  googleCredentialId?: string;
  wordpressCredentialId?: string;
};

export type AutomationJobItem = {
  id: string;
  siteId: string | null;
  userId: string | null;
  workflowId: string;
  name: string;
  topic: string;
  settings: JobSettings;
  credentialRefs: JobCredentialRefs;
  /** Hydrated for owner editor only — không lưu plaintext trên job */
  credentials: WorkflowUiCredentials;
  status: JobStatus;
  errorMessage: string | null;
  n8n: {
    ok: boolean;
    status: number;
    message: string;
    webhookUrl?: string;
  } | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const DEFAULT_JOB_SETTINGS: JobSettings = {
  model: '',
  spreadsheetId: '',
};

export const DEFAULT_JOB_CREDENTIAL_REFS: JobCredentialRefs = {};

export type AutomationsListResponse = {
  workflows: WorkflowItem[];
  jobs: AutomationJobItem[];
};

type WorkflowItemBase = {
  id: string;
  userId: string | null;
  siteId: string | null;
  name: string;
  status: WorkflowStatus;
  triggers: number;
  updatedAt: string;
  lastModified: string;
  apps: AppId[];
  config: WorkflowConfig;
  credentials: WorkflowUiCredentials;
  nodeCredentials: WorkflowNodeCredential[];
};

export type WorkflowItem =
  | (WorkflowItemBase & {
      type: 'generate-idea-posts';
      config: GenerateIdeaPostsConfig;
    })
  | (WorkflowItemBase & {
      type: 'generate-content-post';
      config: GenerateContentPostConfig;
    });

const DEFAULT_WEBHOOK_CONFIG: WorkflowWebhookConfig = {
  useProductionWebhook: false,
  webhookTestUrl: '',
  webhookProductionUrl: '',
};

export const DEFAULT_IDEA_POSTS_CONFIG: GenerateIdeaPostsConfig = {
  ...DEFAULT_WEBHOOK_CONFIG,
  topic: '',
  googleOAuth: { credentialId: '' },
  apiKeyCredentialId: '',
};

export const DEFAULT_CONTENT_POST_CONFIG: GenerateContentPostConfig = {
  ...DEFAULT_WEBHOOK_CONFIG,
  googleOAuth: { credentialId: '' },
  wordpressCredentialId: '',
};

export const DEFAULT_WORKFLOW_CONFIG_BY_TYPE: WorkflowConfigByType = {
  'generate-idea-posts': DEFAULT_IDEA_POSTS_CONFIG,
  'generate-content-post': DEFAULT_CONTENT_POST_CONFIG,
};

/** @deprecated Dùng DEFAULT_WORKFLOW_CONFIG_BY_TYPE[type] */
export const DEFAULT_WORKFLOW_CONFIG = DEFAULT_IDEA_POSTS_CONFIG;

export function getDefaultConfigForType<T extends WorkflowType>(
  type: T,
): WorkflowConfigByType[T] {
  return structuredClone(DEFAULT_WORKFLOW_CONFIG_BY_TYPE[type]);
}

export function getConfigTopic(config: WorkflowConfig): string {
  return 'topic' in config ? config.topic : '';
}

export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
