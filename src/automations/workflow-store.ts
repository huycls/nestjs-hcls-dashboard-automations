import type {
  AppId,
  WorkflowItem,
  WorkflowNodeConfig,
  WorkflowType,
} from "@/lib/automations/data";
import { DEFAULT_WORKFLOW_CONFIG } from "@/lib/automations/data";

const STORAGE_KEY = "flowaxon-workflows";

function readStorage(): WorkflowItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as WorkflowItem[];
  } catch {
    return [];
  }
}

function writeStorage(workflows: WorkflowItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workflows));
  window.dispatchEvent(new Event("flowaxon-workflows-updated"));
}

export function loadWorkflows(): WorkflowItem[] {
  return readStorage();
}

export function saveWorkflows(workflows: WorkflowItem[]) {
  writeStorage(workflows);
}

export function getWorkflowById(id: string): WorkflowItem | undefined {
  return readStorage().find((workflow) => workflow.id === id);
}

function formatLastModified(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function createWorkflow(name: string, type: WorkflowType): WorkflowItem {
  const now = new Date();
  const workflow: WorkflowItem = {
    id: `wf-${crypto.randomUUID()}`,
    name: name.trim(),
    type,
    status: "Draft",
    triggers: 0,
    updatedAt: now.toISOString().slice(0, 10),
    lastModified: "Just now",
    apps: [] as AppId[],
    config: { ...DEFAULT_WORKFLOW_CONFIG },
  };

  const workflows = readStorage();
  writeStorage([workflow, ...workflows]);

  return workflow;
}

export function updateWorkflow(
  id: string,
  patch: Partial<Pick<WorkflowItem, "name" | "status">>,
) {
  const workflows = readStorage().map((workflow) =>
    workflow.id === id
      ? {
          ...workflow,
          ...patch,
          lastModified: formatLastModified(new Date()),
        }
      : workflow,
  );

  writeStorage(workflows);
}

export function deleteWorkflowById(id: string) {
  writeStorage(readStorage().filter((workflow) => workflow.id !== id));
}

export function updateWorkflowConfig(
  id: string,
  config: WorkflowNodeConfig,
) {
  const workflows = readStorage().map((workflow) =>
    workflow.id === id
      ? {
          ...workflow,
          config,
          lastModified: formatLastModified(new Date()),
        }
      : workflow,
  );

  writeStorage(workflows);
}

export function incrementWorkflowTriggers(id: string) {
  const workflows = readStorage().map((workflow) =>
    workflow.id === id
      ? {
          ...workflow,
          triggers: workflow.triggers + 1,
          lastModified: "Just now",
        }
      : workflow,
  );

  writeStorage(workflows);
}
