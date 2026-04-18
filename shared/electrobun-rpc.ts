import type { RPCSchema } from "electrobun/view";
import type { DesktopAction } from "./desktop-actions";
import type {
  AnyDesktopActionPayload,
  ArchivedThread,
  ComposerAttachment,
  ComposerFilePickerState,
  ComposerState,
  ComposerStateRequest,
  DesktopActionResult,
  DesktopEvent,
  DictationModelInstallResult,
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
} from "./desktop-contracts";
import type {
  TerminalCloseRequest,
  TerminalEvent,
  TerminalOpenRequest,
  TerminalResizeRequest,
  TerminalSessionSnapshot,
  TerminalWriteRequest,
} from "./terminal-contracts";

export type PiDesktopRpc = {
  bun: RPCSchema<{
    requests: {
      getShellState: { params: Record<string, never>; response: ShellState };
      getProjectGitState: { params: { projectId: string }; response: ProjectGitState | null };
      getProjectDiff: {
        params: { projectId: string; baseline?: ProjectDiffBaseline | null };
        response: ProjectDiffResult | null;
      };
      getProjectDiffStats: {
        params: { projectId: string; baseline?: ProjectDiffBaseline | null };
        response: ProjectDiffStatsResult | null;
      };
      captureProjectDiffBaseline: {
        params: { projectId: string };
        response: ProjectDiffResolvedBaseline | null;
      };
      listProjectCommits: {
        params: { projectId: string; limit?: number | null };
        response: ProjectCommitEntry[];
      };
      searchPiPackages: {
        params: { query?: string | null; cursor?: number | null; pageSize?: number | null };
        response: PiPackageCatalogPage;
      };
      getConfiguredPiPackages: {
        params: { projectPath?: string | null };
        response: PiConfiguredPackage[];
      };
      installPiPackage: {
        params: {
          source: string;
          kind?: "npm" | "git";
          local?: boolean;
          projectPath?: string | null;
        };
        response: PiPackageMutationResult;
      };
      removePiPackage: {
        params: { source: string; local?: boolean; projectPath?: string | null };
        response: PiPackageMutationResult;
      };
      searchPiSkills: {
        params: { query?: string | null; limit?: number | null };
        response: PiSkillCatalogPage;
      };
      getConfiguredPiSkills: {
        params: { projectPath?: string | null };
        response: PiConfiguredSkill[];
      };
      installPiSkill: {
        params: { source: string; local?: boolean; projectPath?: string | null };
        response: PiSkillMutationResult;
      };
      removePiSkill: {
        params: { installedPath: string; projectPath?: string | null };
        response: PiSkillMutationResult;
      };
      startSkillCreatorSession: {
        params: { prompt: string; local?: boolean; projectPath?: string | null };
        response: SkillCreatorSessionState;
      };
      continueSkillCreatorSession: {
        params: { sessionId: string; prompt: string };
        response: SkillCreatorSessionState;
      };
      closeSkillCreatorSession: {
        params: { sessionId: string };
        response: { ok: boolean };
      };
      pickComposerAttachments: {
        params: { projectId?: string | null };
        response: ComposerAttachment[];
      };
      listComposerAttachmentEntries: {
        params: { projectId?: string | null; path?: string | null; rootPath?: string | null };
        response: ComposerFilePickerState;
      };
      getComposerState: { params: ComposerStateRequest; response: ComposerState };
      getDictationState: { params: Record<string, never>; response: DictationState };
      listDictationModels: { params: Record<string, never>; response: DictationModelSummary[] };
      installDictationModel: {
        params: { modelId: "tiny.en" | "base.en" | "small.en" };
        response: DictationModelInstallResult;
      };
      transcribeDictation: {
        params: DictationTranscriptionRequest;
        response: DictationTranscriptionResult;
      };
      getProjectThreads: { params: { projectId: string }; response: Thread[] };
      getInboxThreads: { params: Record<string, never>; response: InboxThread[] };
      getArchivedThreads: { params: Record<string, never>; response: ArchivedThread[] };
      getThread: {
        params: { sessionPath: string; historyCompactions?: number };
        response: ThreadData | null;
      };
      watchSession: { params: { sessionPath: string | null }; response: { ok: boolean } };
      invokeAction: {
        params: { action: DesktopAction; payload?: AnyDesktopActionPayload };
        response: DesktopActionResult;
      };
      listTerminals: { params: Record<string, never>; response: TerminalSessionSnapshot[] };
      terminalOpen: { params: TerminalOpenRequest; response: TerminalSessionSnapshot };
      terminalWrite: { params: TerminalWriteRequest; response: { ok: boolean } };
      terminalResize: { params: TerminalResizeRequest; response: { ok: boolean } };
      terminalClose: { params: TerminalCloseRequest; response: { ok: boolean } };
      openExternal: { params: { url: string }; response: { ok: boolean } };
      openPath: { params: { path: string }; response: { ok: boolean } };
    };
    messages: Record<string, never>;
  }>;
  webview: RPCSchema<{
    requests: Record<string, never>;
    messages: {
      desktopEvent: DesktopEvent;
      terminalEvent: TerminalEvent;
    };
  }>;
};
