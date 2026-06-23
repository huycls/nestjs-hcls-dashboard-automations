"use client";

import { useSyncExternalStore } from "react";
import type { WorkflowItem } from "@/lib/automations/data";

const STORAGE_KEY = "flowaxon-workflows";
const EMPTY_WORKFLOWS: WorkflowItem[] = [];

let cachedRaw: string | null = null;
let cachedWorkflows: WorkflowItem[] = EMPTY_WORKFLOWS;

function readRaw(): string {
  if (typeof window === "undefined") return "[]";
  return localStorage.getItem(STORAGE_KEY) ?? "[]";
}

function invalidateCache() {
  cachedRaw = null;
}

function getWorkflowsSnapshot(): WorkflowItem[] {
  const raw = readRaw();

  if (raw === cachedRaw) {
    return cachedWorkflows;
  }

  cachedRaw = raw;

  try {
    const parsed = JSON.parse(raw) as WorkflowItem[];
    cachedWorkflows = parsed.length > 0 ? parsed : EMPTY_WORKFLOWS;
  } catch {
    cachedWorkflows = EMPTY_WORKFLOWS;
  }

  return cachedWorkflows;
}

function getWorkflowSnapshot(id: string): WorkflowItem | null {
  return getWorkflowsSnapshot().find((workflow) => workflow.id === id) ?? null;
}

function subscribe(callback: () => void) {
  const handleChange = () => {
    invalidateCache();
    callback();
  };

  window.addEventListener("storage", handleChange);
  window.addEventListener("flowaxon-workflows-updated", handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener("flowaxon-workflows-updated", handleChange);
  };
}

export function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function useWorkflows(): WorkflowItem[] {
  return useSyncExternalStore(subscribe, getWorkflowsSnapshot, () => EMPTY_WORKFLOWS);
}

export function useWorkflow(id: string): WorkflowItem | null {
  return useSyncExternalStore(
    subscribe,
    () => getWorkflowSnapshot(id),
    () => null,
  );
}

export function notifyWorkflowStoreUpdated() {
  invalidateCache();
  window.dispatchEvent(new Event("flowaxon-workflows-updated"));
}
