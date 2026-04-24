import { createLocalThreadDraft } from "../../../shared/session-paths";
import type { DesktopAction } from "../desktop/actions";
import type { AnyDesktopActionPayload, DesktopActionResult, Thread } from "../desktop/types";

export type ActionPayload = AnyDesktopActionPayload;

export function getPayloadProjectId(payload: ActionPayload) {
  return typeof payload.projectId === "string" ? payload.projectId : null;
}

export function getPayloadThreadId(payload: ActionPayload) {
  return typeof payload.threadId === "string" ? payload.threadId : null;
}

export function getPayloadThreadIds(payload: ActionPayload) {
  return Array.isArray(payload.threadIds)
    ? payload.threadIds.filter((threadId): threadId is string => typeof threadId === "string")
    : [];
}

export function getPayloadProjectIds(payload: ActionPayload) {
  return Array.isArray(payload.projectIds)
    ? payload.projectIds.filter((projectId): projectId is string => typeof projectId === "string")
    : [];
}

export function getResultThreadIds(threadIds: unknown) {
  return Array.isArray(threadIds)
    ? threadIds.filter((threadId): threadId is string => typeof threadId === "string")
    : [];
}

export function isThreadList(value: unknown): value is Thread[] {
  return Array.isArray(value);
}

export function hasActionError(actionResult: DesktopActionResult | null | undefined) {
  return actionResult?.ok === false || typeof actionResult?.result?.error === "string";
}

export function sortPinnedThreads<T extends { id: string; pinned?: boolean }>(threads: T[]) {
  return [...threads].sort((left, right) => {
    const leftPinned = Boolean(left.pinned);
    const rightPinned = Boolean(right.pinned);

    if (leftPinned !== rightPinned) {
      return leftPinned ? -1 : 1;
    }

    return 0;
  });
}

export function sortPinnedProjects<T extends { id: string; pinned?: boolean }>(projects: T[]) {
  return [...projects].sort((left, right) => {
    const leftPinned = Boolean(left.pinned);
    const rightPinned = Boolean(right.pinned);

    if (leftPinned !== rightPinned) {
      return leftPinned ? -1 : 1;
    }

    return 0;
  });
}

export function hasDesktopBridge() {
  if (typeof window === "undefined") {
    return false;
  }

  return typeof window.piDesktop?.invokeAction === "function";
}

export function buildLocalThreadFallback(projectId: string) {
  return createLocalThreadDraft(projectId);
}

export function isThreadPinAction(action: DesktopAction) {
  return action === "thread.pin";
}
