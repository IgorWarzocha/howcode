import type { DesktopAction } from "./desktop-actions";
import type {
  AppSettings,
  ComposerAttachment,
  ComposerState,
  ComposerStreamingBehavior,
  ComposerThinkingLevel,
  ProjectDeletionMode,
  ProjectImportCandidate,
} from "./desktop-data-contracts";

type EmptyActionPayload = Record<string, never>;

export type DesktopActionPayloadFields = {
  attachments?: ComposerAttachment[];
  folders?: string[];
  imported?: boolean | null;
  includeUnstaged?: boolean;
  key?: keyof AppSettings;
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
  title?: string;
  value?: string | boolean | null;
};

export type DesktopActionPayloadInput = {
  [Key in keyof DesktopActionPayloadFields]?: unknown;
};

export type DesktopSettingsUpdatePayload =
  | { key: "gitCommitMessageModel"; provider: string; modelId: string; reset?: false }
  | { key: "gitCommitMessageModel"; reset: true }
  | { key: "skillCreatorModel"; provider: string; modelId: string; reset?: false }
  | { key: "skillCreatorModel"; reset: true }
  | { key: "composerStreamingBehavior"; value: ComposerStreamingBehavior }
  | { key: "favoriteFolders"; folders: string[] }
  | { key: "projectImportState"; imported: boolean | null }
  | { key: "preferredProjectLocation"; value: string | null }
  | { key: "initializeGitOnProjectCreate"; value: boolean }
  | { key: "projectDeletionMode"; value: ProjectDeletionMode }
  | { key: "useAgentsSkillsPaths"; value: boolean }
  | { key: "piTuiTakeover"; value: boolean };

export type DesktopActionPayloadMap = {
  "threads.collapse-all": EmptyActionPayload;
  "threads.filter": EmptyActionPayload;
  "project.add": { projectName?: string };
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
  "project.create-worktree": EmptyActionPayload;
  "thread.new": { projectId?: string | null; sessionPath?: string | null };
  "thread.open": { projectId?: string | null; sessionPath?: string | null; threadId?: string };
  "thread.archive": { threadId: string };
  "thread.archive-many": { projectId?: string | null; threadIds: string[] };
  "thread.restore": { threadId: string };
  "thread.restore-many": { threadIds: string[]; projectIds?: string[] };
  "thread.delete": { threadId: string };
  "thread.delete-many": { threadIds: string[]; projectIds?: string[] };
  "thread.pin": { threadId: string; projectId?: string | null };
  "thread.actions": EmptyActionPayload;
  "thread.run-action": EmptyActionPayload;
  "workspace.open": EmptyActionPayload;
  "workspace.open-options": EmptyActionPayload;
  "workspace.handoff": EmptyActionPayload;
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
  };
  "workspace.popout": EmptyActionPayload;
  "connections.add": EmptyActionPayload;
  "connections.dismiss-banner": EmptyActionPayload;
  "composer.attach-menu": EmptyActionPayload;
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
  "composer.dictate": EmptyActionPayload;
  "composer.send": {
    projectId?: string | null;
    sessionPath?: string | null;
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
  "inbox.mark-read": { sessionPath: string; projectId?: string | null };
  "inbox.dismiss": { sessionPath: string; projectId?: string | null };
  "composer.host": EmptyActionPayload;
  "plugins.open-card": EmptyActionPayload;
  "automations.open-card": EmptyActionPayload;
  "debug.open-card": EmptyActionPayload;
  "landing.project-switcher": EmptyActionPayload;
  "settings.update": DesktopSettingsUpdatePayload;
  "projects.import.scan": { projectIds: string[] };
  "projects.import.apply": { projectIds: string[] };
  "diff.review": EmptyActionPayload;
  "terminal.close": EmptyActionPayload;
};

export type AnyDesktopActionPayload = DesktopActionPayloadInput;

export type DesktopActionPayload<A extends DesktopAction = DesktopAction> =
  DesktopActionPayloadMap[A];

export type DesktopActionResultData = {
  checkedProjectCount?: number;
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
  previewed?: boolean;
  projectId?: string;
  projects?: ProjectImportCandidate[];
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
    action: DesktopAction;
    payload: AnyDesktopActionPayload;
  };
  result?: DesktopActionResultData | null;
};
