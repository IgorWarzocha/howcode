import { getPersistedSessionPath } from "../../../shared/session-paths";
import type {
  ArchivedThread,
  ComposerAttachment,
  ComposerFilePickerState,
  ComposerState,
  ComposerStateRequest,
  InboxThread,
  PiConfiguredPackage,
  PiConfiguredSkill,
  PiPackageCatalogPage,
  PiPackageMutationResult,
  PiSkillCatalogPage,
  PiSkillMutationResult,
  ProjectCommitEntry,
  ProjectDiffBaseline,
  ProjectDiffResolvedBaseline,
  ProjectDiffResult,
  ProjectDiffStatsResult,
  ProjectGitState,
  ShellState,
  SkillCreatorSessionState,
  Thread,
  ThreadData,
} from "../desktop/types";

export const desktopQueryKeys = {
  shellState: () => ["desktop", "shellState"] as const,
  piPackageCatalog: (query: string) => ["desktop", "piPackages", "catalog", query] as const,
  configuredPiPackages: (projectPath?: string | null) =>
    ["desktop", "piPackages", "configured", projectPath ?? null] as const,
  piSkillCatalog: (query: string) => ["desktop", "piSkills", "catalog", query] as const,
  configuredPiSkills: (projectPath?: string | null) =>
    ["desktop", "piSkills", "configured", projectPath ?? null] as const,
  projectThreads: (projectId: string) => ["desktop", "projectThreads", projectId] as const,
  inboxThreads: () => ["desktop", "inboxThreads"] as const,
  archivedThreads: () => ["desktop", "archivedThreads"] as const,
  composerState: (request: ComposerStateRequest) =>
    [
      "desktop",
      "composerState",
      request.projectId ?? null,
      getPersistedSessionPath(request.sessionPath),
    ] as const,
  projectGitState: (projectId: string) => ["desktop", "projectGitState", projectId] as const,
  projectDiffPrefix: (projectId: string) => ["desktop", "projectDiff", projectId] as const,
  projectDiff: (projectId: string, baseline: ProjectDiffBaseline | null = null) =>
    ["desktop", "projectDiff", projectId, baseline?.kind ?? "head", baseline ?? null] as const,
  projectDiffStatsPrefix: (projectId: string) =>
    ["desktop", "projectDiffStats", projectId] as const,
  projectDiffStats: (projectId: string, baseline: ProjectDiffBaseline | null = null) =>
    ["desktop", "projectDiffStats", projectId, baseline?.kind ?? "head", baseline ?? null] as const,
  projectCommitsPrefix: (projectId: string) => ["desktop", "projectCommits", projectId] as const,
  projectCommits: (projectId: string, limit = 50) =>
    ["desktop", "projectCommits", projectId, limit] as const,
  thread: (sessionPath: string, refreshKey = 0, historyCompactions = 0) =>
    ["desktop", "thread", sessionPath, refreshKey, historyCompactions] as const,
};

export async function getShellStateQuery(): Promise<ShellState | null> {
  return (await window.piDesktop?.getShellState?.()) ?? null;
}

export async function getProjectThreadsQuery(projectId: string): Promise<Thread[]> {
  return (await window.piDesktop?.getProjectThreads?.(projectId)) ?? [];
}

export async function getInboxThreadsQuery(): Promise<InboxThread[]> {
  return (await window.piDesktop?.getInboxThreads?.()) ?? [];
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

export async function getProjectDiffQuery(
  projectId: string,
  baseline: ProjectDiffBaseline | null = null,
): Promise<ProjectDiffResult | null> {
  return (await window.piDesktop?.getProjectDiff?.(projectId, baseline)) ?? null;
}

export async function getProjectDiffStatsQuery(
  projectId: string,
  baseline: ProjectDiffBaseline | null = null,
): Promise<ProjectDiffStatsResult | null> {
  return (await window.piDesktop?.getProjectDiffStats?.(projectId, baseline)) ?? null;
}

export async function captureProjectDiffBaselineQuery(
  projectId: string,
): Promise<ProjectDiffResolvedBaseline | null> {
  return (await window.piDesktop?.captureProjectDiffBaseline?.(projectId)) ?? null;
}

export async function listProjectCommitsQuery(
  projectId: string,
  limit = 50,
): Promise<ProjectCommitEntry[]> {
  return (await window.piDesktop?.listProjectCommits?.(projectId, limit)) ?? [];
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

export async function searchPiSkillsQuery(
  request: {
    query?: string | null;
    limit?: number | null;
  } = {},
): Promise<PiSkillCatalogPage> {
  return (
    (await window.piDesktop?.searchPiSkills?.(request)) ?? {
      query: request.query?.trim() ?? "",
      total: 0,
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

export async function getConfiguredPiSkillsQuery(
  request: {
    projectPath?: string | null;
  } = {},
): Promise<PiConfiguredSkill[]> {
  return (await window.piDesktop?.getConfiguredPiSkills?.(request)) ?? [];
}

export async function installPiSkillQuery(request: {
  source: string;
  local?: boolean;
  projectPath?: string | null;
}): Promise<PiSkillMutationResult | null> {
  return (await window.piDesktop?.installPiSkill?.(request)) ?? null;
}

export async function removePiSkillQuery(request: {
  installedPath: string;
  projectPath?: string | null;
}): Promise<PiSkillMutationResult | null> {
  return (await window.piDesktop?.removePiSkill?.(request)) ?? null;
}

export async function startSkillCreatorSessionQuery(request: {
  prompt: string;
  local?: boolean;
  projectPath?: string | null;
}): Promise<SkillCreatorSessionState | null> {
  return (await window.piDesktop?.startSkillCreatorSession?.(request)) ?? null;
}

export async function continueSkillCreatorSessionQuery(request: {
  sessionId: string;
  prompt: string;
}): Promise<SkillCreatorSessionState | null> {
  return (await window.piDesktop?.continueSkillCreatorSession?.(request)) ?? null;
}

export async function closeSkillCreatorSessionQuery(sessionId: string): Promise<void> {
  await window.piDesktop?.closeSkillCreatorSession?.(sessionId);
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
