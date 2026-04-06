import type {
  ArchivedThread,
  ComposerAttachment,
  ComposerFilePickerState,
  ComposerState,
  ComposerStateRequest,
  PiConfiguredPackage,
  PiPackageCatalogPage,
  PiPackageMutationResult,
  ProjectDiffResult,
  ProjectGitState,
  ShellState,
  Thread,
  ThreadData,
} from "../desktop/types";

export const desktopQueryKeys = {
  shellState: () => ["desktop", "shellState"] as const,
  piPackageCatalog: (query: string) => ["desktop", "piPackages", "catalog", query] as const,
  configuredPiPackages: (projectPath?: string | null) =>
    ["desktop", "piPackages", "configured", projectPath ?? null] as const,
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

export async function searchPiPackagesQuery(
  request: {
    query?: string | null;
    cursor?: number | null;
    pageSize?: number | null;
  } = {},
): Promise<PiPackageCatalogPage> {
  return (
    (await window.piDesktop?.searchPiPackages?.(request)) ?? {
      query: request.query?.trim() ?? "",
      sort: "monthlyDownloads-desc",
      total: 0,
      nextCursor: null,
      items: [],
    }
  );
}

export async function getConfiguredPiPackagesQuery(
  request: {
    projectPath?: string | null;
  } = {},
): Promise<PiConfiguredPackage[]> {
  return (await window.piDesktop?.getConfiguredPiPackages?.(request)) ?? [];
}

export async function installPiPackageQuery(request: {
  source: string;
  kind?: "npm" | "git";
  local?: boolean;
  projectPath?: string | null;
}): Promise<PiPackageMutationResult | null> {
  return (await window.piDesktop?.installPiPackage?.(request)) ?? null;
}

export async function removePiPackageQuery(request: {
  source: string;
  local?: boolean;
  projectPath?: string | null;
}): Promise<PiPackageMutationResult | null> {
  return (await window.piDesktop?.removePiPackage?.(request)) ?? null;
}

export async function pickComposerAttachmentsQuery(
  projectId?: string | null,
): Promise<ComposerAttachment[]> {
  return (await window.piDesktop?.pickComposerAttachments?.(projectId ?? null)) ?? [];
}

export async function listComposerAttachmentEntriesQuery(
  request: {
    projectId?: string | null;
    path?: string | null;
    rootPath?: string | null;
  } = {},
): Promise<ComposerFilePickerState | null> {
  return (await window.piDesktop?.listComposerAttachmentEntries?.(request)) ?? null;
}

export async function getThreadQuery(
  sessionPath: string,
  historyCompactions = 0,
): Promise<ThreadData | null> {
  return (await window.piDesktop?.getThread?.(sessionPath, historyCompactions)) ?? null;
}
