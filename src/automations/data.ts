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

export type WorkflowConfig = {
  topic: string;
  useProductionWebhook: boolean;
  webhookTestUrl: string;
  webhookProductionUrl: string;
};

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

import type { JobStatus } from '../jobs/jobs.constants';

export type AutomationJobItem = {
  id: string;
  siteId: string | null;
  workflowId: string;
  topic: string;
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

export type AutomationsListResponse = {
  workflows: WorkflowItem[];
  jobs: AutomationJobItem[];
};

export type WorkflowItem = {
  id: string;
  siteId: string | null;
  name: string;
  type: WorkflowType;
  status: WorkflowStatus;
  triggers: number;
  updatedAt: string;
  lastModified: string;
  apps: AppId[];
  config: WorkflowConfig;
  credentials: WorkflowUiCredentials;
  nodeCredentials: WorkflowNodeCredential[];
};

export const DEFAULT_WORKFLOW_CONFIG: WorkflowConfig = {
  topic: '',
  useProductionWebhook: false,
  webhookTestUrl: '',
  webhookProductionUrl: '',
};

export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
