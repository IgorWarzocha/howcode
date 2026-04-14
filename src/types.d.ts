import type { DesktopAction } from "./app/desktop/actions";
import type {
  AnyDesktopActionPayload,
  ArchivedThread,
  ComposerAttachment,
  ComposerFilePickerState,
  ComposerState,
  ComposerStateRequest,
  DesktopActionPayload,
  DesktopActionResult,
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
  TerminalCloseRequest,
  TerminalEvent,
  TerminalOpenRequest,
  TerminalResizeRequest,
  TerminalSessionSnapshot,
  Thread,
  ThreadData,
  TurnDiffResult,
} from "./app/desktop/types";

declare global {
  interface Window {
    piDesktop?: {
      getShellState: () => Promise<ShellState>;
      getProjectGitState?: (projectId: string) => Promise<ProjectGitState | null>;
      getProjectDiff?: (
        projectId: string,
        baseline?: ProjectDiffBaseline | null,
      ) => Promise<ProjectDiffResult | null>;
      getProjectDiffStats?: (
        projectId: string,
        baseline?: ProjectDiffBaseline | null,
      ) => Promise<ProjectDiffStatsResult | null>;
      captureProjectDiffBaseline?: (
        projectId: string,
      ) => Promise<ProjectDiffResolvedBaseline | null>;
      listProjectCommits?: (
        projectId: string,
        limit?: number | null,
      ) => Promise<ProjectCommitEntry[]>;
      searchPiPackages?: (request?: {
        query?: string | null;
        cursor?: number | null;
        pageSize?: number | null;
      }) => Promise<PiPackageCatalogPage>;
      getConfiguredPiPackages?: (request?: { projectPath?: string | null }) => Promise<
        PiConfiguredPackage[]
      >;
      installPiPackage?: (request: {
        source: string;
        kind?: "npm" | "git";
        local?: boolean;
        projectPath?: string | null;
      }) => Promise<PiPackageMutationResult>;
      removePiPackage?: (request: {
        source: string;
        local?: boolean;
        projectPath?: string | null;
      }) => Promise<PiPackageMutationResult>;
      searchPiSkills?: (request?: {
        query?: string | null;
        limit?: number | null;
      }) => Promise<PiSkillCatalogPage>;
      getConfiguredPiSkills?: (request?: {
        projectPath?: string | null;
      }) => Promise<PiConfiguredSkill[]>;
      installPiSkill?: (request: {
        source: string;
        local?: boolean;
        projectPath?: string | null;
      }) => Promise<PiSkillMutationResult>;
      removePiSkill?: (request: {
        installedPath: string;
        projectPath?: string | null;
      }) => Promise<PiSkillMutationResult>;
      startSkillCreatorSession?: (request: {
        prompt: string;
        local?: boolean;
        projectPath?: string | null;
      }) => Promise<SkillCreatorSessionState>;
      continueSkillCreatorSession?: (request: {
        sessionId: string;
        prompt: string;
      }) => Promise<SkillCreatorSessionState>;
      closeSkillCreatorSession?: (sessionId: string) => Promise<{ ok: boolean }>;
      pickComposerAttachments?: (projectId?: string | null) => Promise<ComposerAttachment[]>;
      listComposerAttachmentEntries?: (request?: {
        projectId?: string | null;
        path?: string | null;
        rootPath?: string | null;
      }) => Promise<ComposerFilePickerState>;
      getComposerState?: (request?: ComposerStateRequest) => Promise<ComposerState>;
      getProjectThreads?: (projectId: string) => Promise<Thread[]>;
      getInboxThreads?: () => Promise<InboxThread[]>;
      getArchivedThreads?: () => Promise<ArchivedThread[]>;
      getThread?: (sessionPath: string, historyCompactions?: number) => Promise<ThreadData | null>;
      watchSession?: (sessionPath: string | null) => Promise<void>;
      getTurnDiff?: (
        sessionPath: string,
        checkpointTurnCount: number,
      ) => Promise<TurnDiffResult | null>;
      getFullThreadDiff?: (sessionPath: string) => Promise<TurnDiffResult | null>;
      listTerminals?: () => Promise<TerminalSessionSnapshot[]>;
      openTerminal?: (request: TerminalOpenRequest) => Promise<TerminalSessionSnapshot>;
      writeTerminal?: (sessionId: string, data: string) => Promise<void>;
      resizeTerminal?: (request: TerminalResizeRequest) => Promise<void>;
      closeTerminal?: (request: TerminalCloseRequest) => Promise<void>;
      subscribeTerminal?: (listener: (event: TerminalEvent) => void) => () => void;
      openExternal?: (url: string) => Promise<boolean>;
      openPath?: (path: string) => Promise<boolean>;
      subscribe?: (listener: (event: DesktopEvent) => void) => () => void;
      invokeAction: (
        action: DesktopAction,
        payload?: AnyDesktopActionPayload,
      ) => Promise<DesktopActionResult>;
    };
  }
}
