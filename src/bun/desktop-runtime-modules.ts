import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DesktopAction } from "../../shared/desktop-actions";
import type {
  AnyDesktopActionPayload,
  ArchivedThread,
  ComposerState,
  ComposerStateRequest,
  DesktopActionResultData,
  DesktopEvent,
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
} from "../../shared/desktop-contracts";
import type {
  TerminalEvent,
  TerminalOpenRequest,
  TerminalSessionSnapshot,
} from "../../shared/terminal-contracts";

function isBundledDesktopRuntime(moduleUrl: string) {
  const modulePath = fileURLToPath(moduleUrl);
  const bundledRuntimePathSegment = `${path.sep}Resources${path.sep}app${path.sep}bun${path.sep}`;

  return modulePath.includes(bundledRuntimePathSegment);
}

// Electrobun dev and stable desktop bundles both run from the packaged Resources/app layout.
// That layout imports our prebuilt desktop backend .mjs files, so Pi's filesystem aliases do not
// point at a real package tree. Force bundled desktop runtimes onto Pi's virtual module path.
if (isBundledDesktopRuntime(import.meta.url)) {
  process.env.HOWCODE_FORCE_PI_VIRTUAL_MODULES = "1";
}

export type PiThreadsModule = {
  handleDesktopAction: (
    action: DesktopAction,
    payload: AnyDesktopActionPayload,
  ) => Promise<DesktopActionResultData | null | undefined>;
  loadArchivedThreadList: () => Promise<ArchivedThread[]>;
  loadInboxThreadList: () => Promise<InboxThread[]>;
  loadComposerState: (request: ComposerStateRequest) => Promise<ComposerState>;
  searchPiPackages: (request?: {
    query?: string | null;
    cursor?: number | null;
    pageSize?: number | null;
  }) => Promise<PiPackageCatalogPage>;
  listConfiguredPiPackages: (request?: { projectPath?: string | null }) => Promise<
    PiConfiguredPackage[]
  >;
  installPiPackage: (request: {
    source: string;
    kind?: "npm" | "git";
    local?: boolean;
    projectPath?: string | null;
  }) => Promise<PiPackageMutationResult>;
  removePiPackage: (request: {
    source: string;
    local?: boolean;
    projectPath?: string | null;
  }) => Promise<PiPackageMutationResult>;
  loadProjectGitState: (projectId: string) => Promise<ProjectGitState | null>;
  loadProjectDiff: (
    projectId: string,
    baseline?: ProjectDiffBaseline | null,
  ) => Promise<ProjectDiffResult | null>;
  loadProjectDiffStats: (
    projectId: string,
    baseline?: ProjectDiffBaseline | null,
  ) => Promise<ProjectDiffStatsResult | null>;
  captureProjectDiffBaseline: (projectId: string) => Promise<ProjectDiffResolvedBaseline | null>;
  listProjectCommits: (projectId: string, limit?: number | null) => Promise<ProjectCommitEntry[]>;
  loadProjectThreads: (projectId: string) => Promise<Thread[]>;
  loadShellState: (cwd: string) => Promise<ShellState>;
  loadThread: (
    sessionPath: string,
    options?: { historyCompactions?: number },
  ) => Promise<ThreadData | null>;
  setWatchedSessionPath: (sessionPath: string | null) => Promise<void>;
  subscribeDesktopEvents: (listener: (event: DesktopEvent) => void) => () => void;
};

export type TerminalManagerModule = {
  closeTerminal: (request: { sessionId: string; deleteHistory?: boolean }) => Promise<void>;
  listTerminals: () => Promise<TerminalSessionSnapshot[]>;
  openTerminal: (request: TerminalOpenRequest) => Promise<TerminalSessionSnapshot>;
  resizeTerminal: (sessionId: string, cols: number, rows: number) => Promise<void>;
  subscribeTerminalEvents: (listener: (event: TerminalEvent) => void) => () => void;
  writeTerminal: (sessionId: string, data: string) => Promise<void>;
};

export type PiSkillsModule = {
  searchPiSkills: (request?: {
    query?: string | null;
    limit?: number | null;
  }) => Promise<PiSkillCatalogPage>;
  listConfiguredPiSkills: (request?: { projectPath?: string | null }) => Promise<
    PiConfiguredSkill[]
  >;
  installPiSkill: (request: {
    source: string;
    local?: boolean;
    projectPath?: string | null;
  }) => Promise<PiSkillMutationResult>;
  removePiSkill: (request: {
    installedPath: string;
    projectPath?: string | null;
  }) => Promise<PiSkillMutationResult>;
};

export type SkillCreatorModule = {
  startSkillCreatorSession: (request: {
    prompt: string;
    local?: boolean;
    projectPath?: string | null;
  }) => Promise<SkillCreatorSessionState>;
  continueSkillCreatorSession: (request: {
    sessionId: string;
    prompt: string;
  }) => Promise<SkillCreatorSessionState>;
  closeSkillCreatorSession: (request: { sessionId: string }) => Promise<{ ok: boolean }>;
};

export const piThreads = (await import(
  new URL("../build/desktop/pi-threads.mjs", import.meta.url).href
)) as PiThreadsModule;

export const piSkills = (await import(
  new URL("../build/desktop/pi-skills.mjs", import.meta.url).href
)) as PiSkillsModule;

export const skillCreator = (await import(
  new URL("../build/desktop/skill-creator-session.mjs", import.meta.url).href
)) as SkillCreatorModule;

export const terminalManager = (await import(
  new URL("../build/desktop/terminal-manager.mjs", import.meta.url).href
)) as TerminalManagerModule;
