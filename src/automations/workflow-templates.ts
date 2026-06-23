import type { WorkflowType } from './data';

export type NodeIconType =
  | "webhook"
  | "sparkles"
  | "gemini"
  | "openrouter"
  | "code"
  | "split"
  | "sheets"
  | "form"
  | "condition";

export type ConfigurableNodeId =
  | "webhook"
  | "gemini-model"
  | "openrouter-model"
  | "add-to-sheet";

export type CanvasNode = {
  id: string;
  label: string;
  subtitle?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  variant:
    | "zone"
    | "webhook"
    | "ai-agent"
    | "sub-node"
    | "action"
    | "form"
    | "condition";
  configurableId?: ConfigurableNodeId;
  icon?: NodeIconType;
  zoneColor?: "blue" | "green";
};

export type WorkflowTemplate = {
  canvasWidth: number;
  canvasHeight: number;
  nodes: CanvasNode[];
  connections: Array<[string, string]>;
  configurableNodes: ConfigurableNodeId[];
};

const IDEA_POSTS_NODES: CanvasNode[] = [
  {
    id: "zone-generate",
    label: "Generate Topics",
    x: 24,
    y: 48,
    width: 200,
    height: 200,
    variant: "zone",
    zoneColor: "blue",
  },
  {
    id: "webhook",
    label: "Webhook",
    subtitle: "POST",
    x: 56,
    y: 108,
    width: 136,
    height: 72,
    variant: "webhook",
    configurableId: "webhook",
    icon: "webhook",
  },
  {
    id: "ai-generate-topics",
    label: "Generate Blog Topics AI",
    x: 248,
    y: 72,
    width: 200,
    height: 88,
    variant: "ai-agent",
    icon: "sparkles",
  },
  {
    id: "gemini-model",
    label: "Google Gemini Chat Model",
    x: 248,
    y: 176,
    width: 200,
    height: 48,
    variant: "sub-node",
    configurableId: "gemini-model",
    icon: "gemini",
  },
  {
    id: "openrouter-model",
    label: "OpenRouter Chat Model",
    x: 248,
    y: 232,
    width: 200,
    height: 48,
    variant: "sub-node",
    configurableId: "openrouter-model",
    icon: "openrouter",
  },
  {
    id: "parse-output",
    label: "Parse AI Topic Output",
    x: 248,
    y: 288,
    width: 200,
    height: 48,
    variant: "sub-node",
    icon: "code",
  },
  {
    id: "split-topics",
    label: "Split Topics",
    x: 488,
    y: 108,
    width: 136,
    height: 72,
    variant: "action",
    icon: "split",
  },
  {
    id: "zone-sheet",
    label: "Add to Sheet",
    x: 656,
    y: 48,
    width: 200,
    height: 200,
    variant: "zone",
    zoneColor: "blue",
  },
  {
    id: "add-to-sheet",
    label: "Add Ideas to Sheet",
    subtitle: "append: sheet",
    x: 688,
    y: 108,
    width: 136,
    height: 72,
    variant: "action",
    configurableId: "add-to-sheet",
    icon: "sheets",
  },
  {
    id: "zone-add-more",
    label: "Add More?",
    x: 888,
    y: 48,
    width: 180,
    height: 200,
    variant: "zone",
    zoneColor: "blue",
  },
  {
    id: "form-add-more",
    label: "Form: Add More Topics?",
    x: 908,
    y: 108,
    width: 140,
    height: 72,
    variant: "form",
    icon: "form",
  },
  {
    id: "zone-decision",
    label: "Start Over or End",
    x: 1104,
    y: 48,
    width: 200,
    height: 240,
    variant: "zone",
    zoneColor: "green",
  },
  {
    id: "if-add-more",
    label: "If Add More Topics",
    x: 1136,
    y: 108,
    width: 136,
    height: 72,
    variant: "condition",
    icon: "condition",
  },
  {
    id: "form-end",
    label: "Form: End Idea Generation",
    x: 1136,
    y: 200,
    width: 136,
    height: 72,
    variant: "form",
    icon: "form",
  },
];

const IDEA_POSTS_CONNECTIONS: Array<[string, string]> = [
  ["webhook", "ai-generate-topics"],
  ["ai-generate-topics", "split-topics"],
  ["split-topics", "add-to-sheet"],
  ["add-to-sheet", "form-add-more"],
  ["form-add-more", "if-add-more"],
  ["if-add-more", "form-end"],
];

export const IDEA_POSTS_TEMPLATE: WorkflowTemplate = {
  canvasWidth: 1320,
  canvasHeight: 380,
  nodes: IDEA_POSTS_NODES,
  connections: IDEA_POSTS_CONNECTIONS,
  configurableNodes: [
    "webhook",
    "gemini-model",
    "openrouter-model",
    "add-to-sheet",
  ],
};

export const CONTENT_POST_TEMPLATE: WorkflowTemplate = {
  canvasWidth: 900,
  canvasHeight: 320,
  nodes: [
    {
      id: "webhook",
      label: "Webhook",
      subtitle: "POST",
      x: 80,
      y: 120,
      width: 136,
      height: 72,
      variant: "webhook",
      configurableId: "webhook",
      icon: "webhook",
    },
    {
      id: "generate-content",
      label: "Generate Content Post AI",
      x: 280,
      y: 112,
      width: 200,
      height: 88,
      variant: "ai-agent",
      icon: "sparkles",
    },
    {
      id: "gemini-model",
      label: "Google Gemini Chat Model",
      x: 280,
      y: 220,
      width: 200,
      height: 48,
      variant: "sub-node",
      configurableId: "gemini-model",
      icon: "gemini",
    },
    {
      id: "publish",
      label: "Publish to Channels",
      x: 520,
      y: 120,
      width: 160,
      height: 72,
      variant: "action",
      configurableId: "add-to-sheet",
      icon: "sheets",
    },
  ],
  connections: [
    ["webhook", "generate-content"],
    ["generate-content", "publish"],
  ],
  configurableNodes: ["webhook", "gemini-model", "add-to-sheet"],
};

export const WORKFLOW_TEMPLATES: Record<WorkflowType, WorkflowTemplate> = {
  "generate-idea-posts": IDEA_POSTS_TEMPLATE,
  "generate-content-post": CONTENT_POST_TEMPLATE,
};

export const CONFIGURABLE_NODE_META: Record<
  ConfigurableNodeId,
  { title: string; description: string; kind: "webhook" | "credentials" }
> = {
  webhook: {
    title: "Webhook",
    description:
      "Trigger this workflow via POST. Send form field Topic in the request body.",
    kind: "webhook",
  },
  "gemini-model": {
    title: "Google Gemini Chat Model",
    description: "API credentials for Google Gemini chat model.",
    kind: "credentials",
  },
  "openrouter-model": {
    title: "OpenRouter Chat Model",
    description: "API credentials for OpenRouter chat model.",
    kind: "credentials",
  },
  "add-to-sheet": {
    title: "Add Ideas to Sheet",
    description: "Google Sheets credentials and spreadsheet configuration.",
    kind: "credentials",
  },
};
