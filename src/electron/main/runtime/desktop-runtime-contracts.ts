import type { DesktopAction } from "../../../../shared/desktop-actions";
import type {
  AnyDesktopActionPayload,
  ArchivedThread,
  ComposerState,
  ComposerStateRequest,
  ComposerSlashCommand,
  DesktopActionResultData,
  DesktopEvent,
  DictationModelInstallResult,
  DictationModelRemoveResult,
  DictationModelSummary,
  DictationState,
  DictationTranscriptionRequest,
  DictationTranscriptionResult,
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
} from "../../../../shared/desktop-contracts";
import type {
  TerminalEvent,
  TerminalOpenRequest,
  TerminalSessionSnapshot,
} from "../../../../shared/terminal-contracts";

export type PiThreadsModule = {
  handleDesktopAction: (
    action: DesktopAction,
    payload: AnyDesktopActionPayload,
  ) => Promise<DesktopActionResultData | null | undefined>;
  loadArchivedThreadList: () => Promise<ArchivedThread[]>;
  loadInboxThreadList: () => Promise<InboxThread[]>;
  loadComposerState: (request: ComposerStateRequest) => Promise<ComposerState>;
  loadComposerSlashCommands: (request: ComposerStateRequest) => Promise<ComposerSlashCommand[]>;
  getDictationState: () => Promise<DictationState>;
  listDictationModels: () => Promise<DictationModelSummary[]>;
  installDictationModel: (request: {
    modelId: "tiny.en" | "base.en" | "small.en";
  }) => Promise<DictationModelInstallResult>;
  removeDictationModel: (request: {
    modelId: "tiny.en" | "base.en" | "small.en";
  }) => Promise<DictationModelRemoveResult>;
  transcribeDictation: (
    request: DictationTranscriptionRequest,
  ) => Promise<DictationTranscriptionResult>;
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

export type DesktopRuntimeModules = {
  piThreads: PiThreadsModule;
  piSkills: PiSkillsModule;
  skillCreator: SkillCreatorModule;
  terminalManager: TerminalManagerModule;
};
