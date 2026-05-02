import type { DesktopAction } from "./desktop-actions";
import type {
  AppSettings,
  ComposerAttachment,
  ComposerState,
  ComposerStreamingBehavior,
  ComposerThinkingLevel,
  DictationModelId,
  GitOpsMode,
  PiSettings,
  ProjectDiffBaseline,
  ProjectDiffDefaultBaseline,
  ProjectDiffRenderMode,
  ProjectDeletionMode,
  ProjectImportCandidate,
} from "./desktop-data-contracts";

type EmptyActionPayload = Record<string, never>;

export type DesktopActionPayloadFields = {
  attachments?: ComposerAttachment[];
  composerMode?: "chat" | "code" | null;
  chatGroupId?: string | null;
  chatGroupIds?: string[];
  folders?: string[];
  imported?: boolean | null;
  gitOpsMode?: GitOpsMode | null;
  diffBaseline?: ProjectDiffBaseline | null;
  diffRenderMode?: ProjectDiffRenderMode | null;
  includeUnstaged?: boolean;
  key?: keyof AppSettings;
  piSettingsKey?: keyof PiSettings;
  level?: ComposerThinkingLevel;
  message?: string | null;
  modelId?: string;
  preview?: boolean;
  projectId?: string | null;
  projectIds?: string[];
  projectName?: string;
  provider?: string;
  queueId?: string;
  queueSnapshotKey?: string;
  push?: boolean;
  queueIndex?: number;
  queueMode?: Exclude<ComposerStreamingBehavior, "stop">;
  repoUrl?: string | null;
  reset?: boolean;
  sessionPath?: string | null;
  streamingBehavior?: ComposerStreamingBehavior;
  text?: string;
  threadId?: string;
  threadIds?: string[];
  value?: string | number | boolean | ProjectDiffDefaultBaseline | null;
};

export type DesktopActionPayloadInput = {
  [Key in keyof DesktopActionPayloadFields]?: unknown;
};

export type DesktopSettingsUpdatePayload =
  | { key: "chatModel"; provider: string; modelId: string; reset?: false }
  | { key: "chatModel"; reset: true }
  | { key: "chatThinkingLevel"; value: ComposerThinkingLevel }
  | { key: "chatThinkingLevel"; reset: true }
  | { key: "codeModel"; provider: string; modelId: string; reset?: false }
  | { key: "codeModel"; reset: true }
  | { key: "codeThinkingLevel"; value: ComposerThinkingLevel }
  | { key: "codeThinkingLevel"; reset: true }
  | { key: "gitCommitMessageModel"; provider: string; modelId: string; reset?: false }
  | { key: "gitCommitMessageModel"; reset: true }
  | { key: "gitCommitMessageThinkingLevel"; value: ComposerThinkingLevel }
  | { key: "skillCreatorModel"; provider: string; modelId: string; reset?: false }
  | { key: "skillCreatorModel"; reset: true }
  | { key: "skillCreatorThinkingLevel"; value: ComposerThinkingLevel }
  | { key: "composerStreamingBehavior"; value: ComposerStreamingBehavior }
  | { key: "dictationModelId"; value: DictationModelId | null }
  | { key: "dictationMaxDurationSeconds"; value: number }
  | { key: "showDictationButton"; value: boolean }
  | { key: "favoriteFolders"; folders: string[] }
  | { key: "projectImportState"; imported: boolean | null }
  | { key: "preferredProjectLocation"; value: string | null }
  | { key: "initializeGitOnProjectCreate"; value: boolean }
  | { key: "gitOpsDefaultMode"; value: GitOpsMode }
  | { key: "gitDiffBaselineDefault"; value: ProjectDiffDefaultBaseline }
  | { key: "gitDiffRenderModeDefault"; value: ProjectDiffRenderMode }
  | { key: "gitDiffFileTreeDefaultVisible"; value: boolean }
  | { key: "projectDeletionMode"; value: ProjectDeletionMode }
  | { key: "useAgentsSkillsPaths"; value: boolean }
  | { key: "piTuiTakeover"; value: boolean };

export type DesktopActionPayloadMap = {
  "threads.collapse-all": EmptyActionPayload;
  "project.add": { projectName?: string; repoUrl?: string | null };
  "project.select": { projectId?: string | null; sessionPath?: string | null };
  "project.expand": { projectId: string };
  "project.collapse": { projectId: string };
  "project.open-in-file-manager": { projectId: string };
  "project.reorder": { projectIds: string[] };
  "project.pin": { projectId: string };
  "project.edit-name": { projectId: string; projectName: string };
  "project.refresh-repo-origin": { projectId: string };
  "project.archive-threads": { projectId: string; projectName?: string };
  "project.remove-project": { projectId: string; projectName?: string };
  "chat.group.create": { chatGroupId?: string | null; value?: string | null };
  "chat.group.rename": { chatGroupId: string; value: string };
  "chat.group.reorder": { chatGroupIds: string[] };
  "chat.group.collapse": { chatGroupId: string; value: boolean };
  "chat.thread.move": {
    threadId: string;
    sessionPath?: string | null;
    chatGroupId?: string | null;
  };
  "thread.new": {
    projectId?: string | null;
    sessionPath?: string | null;
    chatGroupId?: string | null;
  };
  "thread.open": { projectId?: string | null; sessionPath?: string | null; threadId?: string };
  "thread.archive": { threadId: string };
  "thread.archive-many": { projectId?: string | null; threadIds: string[] };
  "thread.restore": { threadId: string };
  "thread.restore-many": { threadIds: string[]; projectIds?: string[] };
  "thread.delete": { threadId: string };
  "thread.delete-many": { threadIds: string[]; projectIds?: string[] };
  "thread.pin": { threadId: string; projectId?: string | null };
  "workspace.commit": {
    projectId?: string | null;
    sessionPath?: string | null;
    includeUnstaged?: boolean;
    message?: string | null;
    preview?: boolean;
    push?: boolean;
  };
  "workspace.commit-options": {
    projectId?: string | null;
    sessionPath?: string | null;
    repoUrl?: string | null;
    gitOpsMode?: GitOpsMode | null;
  };
  "workspace.diff-preferences": {
    projectId?: string | null;
    sessionPath?: string | null;
    diffBaseline?: ProjectDiffBaseline | null;
    diffRenderMode?: ProjectDiffRenderMode | null;
  };
  "composer.model": {
    projectId?: string | null;
    sessionPath?: string | null;
    provider: string;
    modelId: string;
  };
  "composer.thinking": {
    projectId?: string | null;
    sessionPath?: string | null;
    level: ComposerThinkingLevel;
  };
  "composer.send": {
    projectId?: string | null;
    sessionPath?: string | null;
    chatGroupId?: string | null;
    text: string;
    attachments?: ComposerAttachment[];
    streamingBehavior?: ComposerStreamingBehavior;
  };
  "composer.stop": { projectId?: string | null; sessionPath?: string | null };
  "composer.dequeue": {
    projectId?: string | null;
    sessionPath?: string | null;
    queueId: string;
    queueSnapshotKey: string;
    queueMode: Exclude<ComposerStreamingBehavior, "stop">;
  };
  "composer.reload-settings": { projectId?: string | null; sessionPath?: string | null };
  "inbox.mark-read": { sessionPath: string; projectId?: string | null };
  "inbox.dismiss": { sessionPath: string; projectId?: string | null };
  "settings.update": DesktopSettingsUpdatePayload;
  "settings.clear-clipboard-images": EmptyActionPayload;
  "pi-settings.update": { piSettingsKey: keyof PiSettings; value: string | number | boolean };
  "projects.import.scan": { projectIds: string[] };
  "projects.import.apply": { projectIds: string[] };
};

export type AnyDesktopActionPayload = DesktopActionPayloadInput;

export type DesktopActionPayload<A extends DesktopAction = DesktopAction> =
  DesktopActionPayloadMap[A];

export type DesktopActionResultData = {
  checkedProjectCount?: number;
  clearedCount?: number;
  clearFailedCount?: number;
  committed?: boolean;
  composer?: ComposerState;
  composerSendOutcome?: "sent" | "stopped";
  dequeuedText?: string | null;
  deletedThreadIds?: string[];
  didMutate?: boolean;
  error?: string;
  failedThreadIds?: string[];
  importedProjectIds?: string[];
  message?: string | null;
  originProjectCount?: number;
  originUrl?: string | null;
  piSettings?: PiSettings;
  previewed?: boolean;
  projectId?: string;
  projects?: ProjectImportCandidate[];
  pushed?: boolean;
  pushFailed?: boolean;
  repoProjectCount?: number;
  sessionPath?: string | null;
  threadId?: string;
};

export type DesktopActionInvoker = (
  action: DesktopAction,
  payload?: DesktopActionPayloadInput,
) => Promise<DesktopActionResult | null>;

export type DesktopActionResult<A extends DesktopAction = DesktopAction> = {
  ok: boolean;
  at: string;
  payload: {
    action: A;
    payload: AnyDesktopActionPayload;
  };
  result?: DesktopActionResultData | null;
};
