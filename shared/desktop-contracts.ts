export type {
  DirectoryCommitEntry,
  DirectoryDiffBaseline,
  DirectoryDiffDefaultBaseline,
  DirectoryDiffFileContentIssue,
  DirectoryDiffFileContentsRequest,
  DirectoryDiffFileContentsResult,
  DirectoryDiffImagePreview,
  DirectoryDiffImageSide,
  DirectoryDiffPreferences,
  DirectoryDiffRenderMode,
  DirectoryDiffResolvedBaseline,
  DirectoryDiffResult,
  DirectoryDiffStatsResult,
  DirectoryDiffStreamEvent,
  DirectoryDiffStreamStartResult,
  DirectoryDiffTextFile,
  DirectoryFileWriteRequest,
  DirectoryFileWriteResult,
  DirectoryGitState,
} from '@howaboua/howcode-git/contracts'
export type { ChatSearchMatch, ChatSearchResult } from './chat-search'
export type {
  AnyDesktopActionPayload,
  DesktopActionInvoker,
  DesktopActionPayload,
  DesktopActionPayloadFields,
  DesktopActionPayloadInput,
  DesktopActionPayloadMap,
  DesktopActionResult,
  DesktopActionResultData,
  DesktopSettingsUpdatePayload,
} from './desktop-action-contracts'
export type {
  Artifact,
  ArtifactKind,
  ArtifactVersion,
  ReactArtifactCompileResult,
} from './desktop-artifact-contracts'
export type { DesktopBridgeCapabilities } from './desktop-bridge-capabilities'
export type {
  ArchivedChat,
  AssistantUsageSummary,
  BashExecutionMessage,
  Chat,
  ChatCustomMessageRecord,
  ChatData,
  CustomChatMessage,
  DirectoryImportCandidate,
  DirectoryUsageSessionSummary,
  DirectoryUsageSummary,
  InboxChat,
  Message,
  ProseMessage,
  SummaryChatMessage,
  SystemChatMessage,
  ToolResultImage,
  ToolResultMessage,
  WorkingDirectory,
} from './desktop-chat-contracts'
export type {
  ComposerAttachment,
  ComposerContextUsage,
  ComposerFilePickerEntry,
  ComposerFilePickerState,
  ComposerFileSearchEntry,
  ComposerModel,
  ComposerQueuedPrompt,
  ComposerSkillReference,
  ComposerSlashCommand,
  ComposerSlashCommandSource,
  ComposerState,
  ComposerStateRequest,
  ComposerStreamingBehavior,
  ComposerThinkingLevel,
} from './desktop-composer-contracts'
export type {
  DictationModelId,
  DictationModelInstallResult,
  DictationModelRemoveResult,
  DictationModelSummary,
  DictationState,
  DictationTranscriptionRequest,
  DictationTranscriptionResult,
} from './desktop-dictation-contracts'
export type { DesktopEvent } from './desktop-event-contracts'
export type {
  PiConfiguredSkill,
  PiSkillCatalogItem,
  PiSkillCatalogPage,
  PiSkillMutationResult,
} from './desktop-package-contracts'
export type {
  AppSettings,
  DirectoryDeletionMode,
  GitOpsMode,
  ModelSelection,
  PiQueueMode,
  PiSettings,
  PiThemeState,
  PiTransportMode,
  ShellState,
} from './desktop-settings-contracts'
export type {
  Workspace,
  WorkspaceChat,
  WorkspaceNavigationState,
} from './desktop-workspace-contracts'
export type {
  ComposerSendMode,
  KeybindingCommandId,
  KeybindingConflict,
  KeybindingDefinition,
  KeybindingOverrides,
} from './keybindings'
export {
  bundledKeybindings,
  getConflictForCommand,
  getEffectiveAccelerators,
  getKeybindingConflicts,
  isKeybindingCommandId,
  normalizeAccelerator,
} from './keybindings'
