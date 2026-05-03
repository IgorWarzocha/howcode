import type { DesktopAction } from "./app/desktop/actions";
import type {
  AnyDesktopActionPayload,
  AppUpdateState,
  Artifact,
  ArtifactVersion,
  ArchivedThread,
  ChatSidebarState,
  ComposerAttachment,
  DesktopClipboardFilePaths,
  DesktopClipboardImage,
  DesktopClipboardSnapshot,
  ComposerFilePickerState,
  ComposerSlashCommand,
  ComposerState,
  ComposerStateRequest,
  DesktopActionResult,
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
  ReactArtifactCompileResult,
  ShellState,
  SkillCreatorSessionState,
  TerminalCloseRequest,
  TerminalEvent,
  TerminalOpenRequest,
  TerminalResizeRequest,
  TerminalSessionFileStat,
  TerminalSessionSnapshot,
  TerminalStatusSnapshot,
  Thread,
  ThreadData,
} from "./app/desktop/types";

declare global {
  interface Window {
    __howcodeDevWebBridge?: boolean;
    piDesktop?: {
      getAppUpdateState?: () => Promise<AppUpdateState>;
      checkAppUpdate?: () => Promise<AppUpdateState>;
      installAppUpdate?: () => Promise<AppUpdateState>;
      restartAppUpdate?: () => Promise<AppUpdateState>;
      clearClipboardImages?: () => Promise<{ clearedCount: number; clearFailedCount: number }>;
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
      getConfiguredPiPackages?: (request?: {
        projectPath?: string | null;
        chat?: boolean;
      }) => Promise<PiConfiguredPackage[]>;
      installPiPackage?: (request: {
        source: string;
        kind?: "npm" | "git";
        local?: boolean;
        projectPath?: string | null;
        chat?: boolean;
      }) => Promise<PiPackageMutationResult>;
      removePiPackage?: (request: {
        source: string;
        local?: boolean;
        projectPath?: string | null;
        chat?: boolean;
      }) => Promise<PiPackageMutationResult>;
      searchPiSkills?: (request?: {
        query?: string | null;
        limit?: number | null;
      }) => Promise<PiSkillCatalogPage>;
      getConfiguredPiSkills?: (request?: {
        projectPath?: string | null;
        chat?: boolean;
      }) => Promise<PiConfiguredSkill[]>;
      installPiSkill?: (request: {
        source: string;
        local?: boolean;
        projectPath?: string | null;
        chat?: boolean;
      }) => Promise<PiSkillMutationResult>;
      removePiSkill?: (request: {
        installedPath: string;
        projectPath?: string | null;
        chat?: boolean;
      }) => Promise<PiSkillMutationResult>;
      startSkillCreatorSession?: (request: {
        prompt: string;
        local?: boolean;
        projectPath?: string | null;
        chat?: boolean;
      }) => Promise<SkillCreatorSessionState>;
      continueSkillCreatorSession?: (request: {
        sessionId: string;
        prompt: string;
      }) => Promise<SkillCreatorSessionState>;
      closeSkillCreatorSession?: (sessionId: string) => Promise<{ ok: boolean }>;
      pickComposerAttachments?: (projectId?: string | null) => Promise<ComposerAttachment[]>;
      readClipboardSnapshot?: (formats?: string[] | null) => Promise<DesktopClipboardSnapshot>;
      readClipboardFilePaths?: () => Promise<DesktopClipboardFilePaths>;
      readClipboardImage?: () => Promise<DesktopClipboardImage>;
      getAttachmentKindsForPaths?: (
        paths: string[],
      ) => Promise<Record<string, ComposerAttachment["kind"] | null>>;
      getPathForFile?: (file: File) => string | null;
      listComposerAttachmentEntries?: (request?: {
        projectId?: string | null;
        path?: string | null;
        rootPath?: string | null;
      }) => Promise<ComposerFilePickerState>;
      getComposerState?: (request?: ComposerStateRequest) => Promise<ComposerState>;
      getComposerSlashCommands?: (
        request?: ComposerStateRequest,
      ) => Promise<ComposerSlashCommand[]>;
      getDictationState?: () => Promise<DictationState>;
      listDictationModels?: () => Promise<DictationModelSummary[]>;
      installDictationModel?: (
        modelId: "tiny.en" | "base.en" | "small.en",
      ) => Promise<DictationModelInstallResult>;
      removeDictationModel?: (
        modelId: "tiny.en" | "base.en" | "small.en",
      ) => Promise<DictationModelRemoveResult>;
      transcribeDictation?: (
        request: DictationTranscriptionRequest,
      ) => Promise<DictationTranscriptionResult>;
      getProjectThreads?: (projectId: string, request?: { chat?: boolean }) => Promise<Thread[]>;
      getChatSidebarState?: (selectedGroupId?: string | null) => Promise<ChatSidebarState>;
      createChatGroup?: (name: string) => Promise<ChatSidebarState>;
      listArtifacts?: (conversationId?: string | null) => Promise<Artifact[]>;
      getArtifact?: (
        artifactSlug: string,
        conversationId?: string | null,
      ) => Promise<Artifact | null>;
      updateArtifact?: (
        artifactSlug: string,
        content: string,
        conversationId?: string | null,
      ) => Promise<Artifact>;
      editArtifact?: (
        artifactSlug: string,
        edits: Array<{ oldText: string; newText: string }>,
        conversationId?: string | null,
      ) => Promise<Artifact>;
      listArtifactVersions?: (artifactSlug: string) => Promise<ArtifactVersion[]>;
      compileReactArtifact?: (source: string) => Promise<ReactArtifactCompileResult>;
      getInboxThreads?: () => Promise<InboxThread[]>;
      getArchivedThreads?: () => Promise<ArchivedThread[]>;
      getThread?: (sessionPath: string, historyCompactions?: number) => Promise<ThreadData | null>;
      watchSession?: (sessionPath: string | null) => Promise<void>;
      listTerminals?: () => Promise<TerminalSessionSnapshot[]>;
      openTerminal?: (request: TerminalOpenRequest) => Promise<TerminalSessionSnapshot>;
      writeTerminal?: (sessionId: string, data: string) => Promise<void>;
      resizeTerminal?: (request: TerminalResizeRequest) => Promise<void>;
      closeTerminal?: (request: TerminalCloseRequest) => Promise<void>;
      statTerminalSessionFile?: (sessionId: string) => Promise<TerminalSessionFileStat | null>;
      getTerminalStatus?: (sessionId: string) => Promise<TerminalStatusSnapshot>;
      subscribeTerminal?: (listener: (event: TerminalEvent) => void) => () => void;
      openExternal?: (url: string) => Promise<boolean>;
      openPath?: (path: string) => Promise<boolean>;
      saveTextToDownloads?: (
        fileName: string,
        content: string,
      ) => Promise<{ ok: boolean; path?: string; error?: string }>;
      subscribe?: (listener: (event: DesktopEvent) => void) => () => void;
      invokeAction: (
        action: DesktopAction,
        payload?: AnyDesktopActionPayload,
      ) => Promise<DesktopActionResult>;
    };
  }
}
