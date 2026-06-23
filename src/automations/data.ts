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

export type WorkflowStatus = 'Active' | 'Paused' | 'Draft';

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

export const WORKFLOW_TYPES: Array<{
  id: WorkflowType;
  title: string;
  description: string;
}> = [
  {
    id: 'generate-idea-posts',
    title: 'Generate Idea Posts',
    description: 'Brainstorm and generate post ideas for your social channels.',
  },
  {
    id: 'generate-content-post',
    title: 'Generate Content Post',
    description: 'Create full content posts ready to publish across platforms.',
  },
];

export const WORKFLOW_TYPE_LABELS: Record<WorkflowType, string> = {
  'generate-idea-posts': 'Generate Idea Posts',
  'generate-content-post': 'Generate Content Post',
};

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
