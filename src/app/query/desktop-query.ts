import type {
  ArchivedThread,
  ComposerAttachment,
  ComposerState,
  ComposerStateRequest,
  ProjectDiffResult,
  ProjectGitState,
  ShellState,
  Thread,
  ThreadData,
} from "../desktop/types";

export const desktopQueryKeys = {
  shellState: () => ["desktop", "shellState"] as const,
  projectThreads: (projectId: string) => ["desktop", "projectThreads", projectId] as const,
  archivedThreads: () => ["desktop", "archivedThreads"] as const,
  composerState: (request: ComposerStateRequest) =>
    ["desktop", "composerState", request.projectId ?? null, request.sessionPath ?? null] as const,
  projectGitState: (projectId: string) => ["desktop", "projectGitState", projectId] as const,
  projectDiff: (projectId: string) => ["desktop", "projectDiff", projectId] as const,
  thread: (sessionPath: string, refreshKey = 0, historyCompactions = 0) =>
    ["desktop", "thread", sessionPath, refreshKey, historyCompactions] as const,
};

export async function getShellStateQuery(): Promise<ShellState | null> {
  return (await window.piDesktop?.getShellState?.()) ?? null;
}

export async function getProjectThreadsQuery(projectId: string): Promise<Thread[]> {
  return (await window.piDesktop?.getProjectThreads?.(projectId)) ?? [];
}

export async function getArchivedThreadsQuery(): Promise<ArchivedThread[]> {
  return (await window.piDesktop?.getArchivedThreads?.()) ?? [];
}

export async function getComposerStateQuery(
  request: ComposerStateRequest = {},
): Promise<ComposerState | null> {
  return (await window.piDesktop?.getComposerState?.(request)) ?? null;
}

export async function getProjectGitStateQuery(projectId: string): Promise<ProjectGitState | null> {
  return (await window.piDesktop?.getProjectGitState?.(projectId)) ?? null;
}

export async function getProjectDiffQuery(projectId: string): Promise<ProjectDiffResult | null> {
  return (await window.piDesktop?.getProjectDiff?.(projectId)) ?? null;
}

export async function pickComposerAttachmentsQuery(
  projectId?: string | null,
): Promise<ComposerAttachment[]> {
  return (await window.piDesktop?.pickComposerAttachments?.(projectId ?? null)) ?? [];
}

export async function getThreadQuery(
  sessionPath: string,
  historyCompactions = 0,
): Promise<ThreadData | null> {
  return (await window.piDesktop?.getThread?.(sessionPath, historyCompactions)) ?? null;
}
