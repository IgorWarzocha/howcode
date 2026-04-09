import type { DesktopAction } from "./desktop-actions";

type EmptyActionPayload = Record<string, never>;

export type Thread = {
  id: string;
  title: string;
  age: string;
  sessionPath?: string;
  summary?: string;
  pinned?: boolean;
};

export type Project = {
  id: string;
  name: string;
  threads: Thread[];
  pinned?: boolean;
  collapsed?: boolean;
  threadsLoaded?: boolean;
  threadCount?: number;
  repoOriginUrl?: string | null;
  repoOriginChecked?: boolean;
};

export type ProjectImportCandidate = {
  projectId: string;
  name: string;
  isGitRepo: boolean;
  hasOrigin: boolean;
  originUrl: string | null;
  alreadyImported: boolean;
};

export type ArchivedThread = {
  id: string;
  title: string;
  age: string;
  projectId: string;
  projectName: string;
  sessionPath: string;
};

export type ProseMessage = {
  id: string;
  role: "assistant" | "user";
  format?: "prose" | "list";
  content: string[];
  thinkingContent?: string[];
  thinkingHeaders?: string[];
  thinkingRedacted?: boolean;
};

export type ToolResultMessage = {
  id: string;
  role: "toolResult";
  toolName: string;
  content: string[];
  isError: boolean;
};

export type BashExecutionMessage = {
  id: string;
  role: "bashExecution";
  command: string;
  output: string[];
  exitCode: number | null;
  cancelled: boolean;
  truncated: boolean;
};

export type CustomThreadMessage = {
  id: string;
  role: "custom";
  customType: string;
  content: string[];
};

export type SummaryThreadMessage = {
  id: string;
  role: "branchSummary" | "compactionSummary";
  content: string[];
};

export type Message =
  | ProseMessage
  | ToolResultMessage
  | BashExecutionMessage
  | CustomThreadMessage
  | SummaryThreadMessage;

export type ComposerThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

export type ComposerModel = {
  provider: string;
  id: string;
  name: string;
  reasoning: boolean;
  input: Array<"text" | "image">;
};

export type ComposerState = {
  currentModel: ComposerModel | null;
  availableModels: ComposerModel[];
  currentThinkingLevel: ComposerThinkingLevel;
  availableThinkingLevels: ComposerThinkingLevel[];
};

export type ComposerAttachment = {
  path: string;
  name: string;
  kind: "text" | "image";
};

export type PiPackageCatalogItem = {
  name: string;
  version: string;
  description: string | null;
  keywords: string[];
  monthlyDownloads: number;
  weeklyDownloads: number;
  searchScore: number;
  publishedAt: string;
  updatedAt: string;
  npmUrl: string;
  homepageUrl: string | null;
  repositoryUrl: string | null;
  source: string;
  identityKey: string;
};

export type PiPackageCatalogPage = {
  query: string;
  sort: "monthlyDownloads-desc";
  total: number;
  nextCursor: number | null;
  items: PiPackageCatalogItem[];
};

export type PiConfiguredPackageType = "npm" | "git" | "local";

export type PiConfiguredPackage = {
  resourceKind: "package" | "extension";
  source: string;
  identityKey: string;
  displayName: string;
  type: PiConfiguredPackageType;
  scope: "user" | "project";
  filtered: boolean;
  installedPath: string | null;
  settingsPath: string | null;
};

export type PiPackageMutationResult = {
  source: string;
  normalizedSource: string;
  configuredPackages: PiConfiguredPackage[];
};

export type PiSkillCatalogItem = {
  id: string;
  skillId: string;
  name: string;
  source: string;
  installs: number;
  description: string | null;
  url: string;
  sourceUrl: string;
  identityKey: string;
};

export type PiSkillCatalogPage = {
  query: string;
  total: number;
  items: PiSkillCatalogItem[];
};

export type PiConfiguredSkill = {
  source: string;
  identityKey: string;
  displayName: string;
  description: string | null;
  scope: "user" | "project";
  provenance: "skills.sh" | "local";
  installedPath: string;
  skillFilePath: string;
  sourceRepo: string | null;
  sourceUrl: string | null;
};

export type PiSkillMutationResult = {
  source: string;
  normalizedSource: string;
  configuredSkills: PiConfiguredSkill[];
};

export type SkillCreatorSessionMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

export type SkillCreatorSessionState = {
  sessionId: string;
  messages: SkillCreatorSessionMessage[];
  latestResponse: string | null;
  createdSkillPath: string | null;
};

export type ComposerFilePickerEntry = {
  path: string;
  name: string;
  kind: "directory" | "text" | "image";
};

export type ComposerFilePickerState = {
  homePath: string;
  rootPath: string;
  currentPath: string;
  parentPath: string | null;
  entries: ComposerFilePickerEntry[];
};

export type ModelSelection = {
  provider: string;
  id: string;
};

export type AppSettings = {
  gitCommitMessageModel: ModelSelection | null;
  skillCreatorModel: ModelSelection | null;
  favoriteFolders: string[];
  projectImportState: boolean | null;
  preferredProjectLocation: string | null;
  initializeGitOnProjectCreate: boolean;
  useAgentsSkillsPaths: boolean;
};

export type ComposerStateRequest = {
  projectId?: string | null;
  sessionPath?: string | null;
};

export type ProjectGitState = {
  projectId: string;
  isGitRepo: boolean;
  branch: string | null;
  fileCount: number;
  stagedFileCount: number;
  unstagedFileCount: number;
  insertions: number;
  deletions: number;
  hasOrigin: boolean;
  originName: string | null;
  originUrl: string | null;
};

export type TurnDiffStatus = "ready" | "missing" | "error";

export type TurnDiffFile = {
  path: string;
  kind: string;
  additions: number;
  deletions: number;
};

export type TurnDiffSummary = {
  checkpointTurnCount: number;
  checkpointRef: string;
  status: TurnDiffStatus;
  files: TurnDiffFile[];
  assistantMessageId?: string;
  completedAt: string;
};

export type TurnDiffResult = {
  sessionPath: string;
  fromTurnCount: number;
  toTurnCount: number;
  diff: string;
};

export type ProjectDiffResult = {
  projectId: string;
  diff: string;
};

export type ShellState = {
  platform: string;
  mockMode: boolean;
  productName: string;
  cwd: string;
  agentDir: string;
  sessionDir: string;
  projects: Project[];
  appSettings: AppSettings;
  availableHosts: string[];
  composer: ComposerState;
};

export type ThreadData = {
  sessionPath: string;
  title: string;
  messages: Message[];
  previousMessageCount: number;
  isStreaming: boolean;
  turnDiffSummaries: TurnDiffSummary[];
};

export type DesktopEvent =
  | {
      type: "thread-update";
      reason: "start" | "update" | "end" | "external";
      projectId: string;
      threadId: string;
      sessionPath: string;
      thread: ThreadData;
      composer: ComposerState | null;
    }
  | {
      type: "composer-update";
      composer: ComposerState;
    };

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
  push?: boolean;
  repoUrl?: string | null;
  reset?: boolean;
  sessionPath?: string | null;
  text?: string;
  threadId?: string;
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
  | { key: "favoriteFolders"; folders: string[] }
  | { key: "projectImportState"; imported: boolean | null }
  | { key: "preferredProjectLocation"; value: string | null }
  | { key: "initializeGitOnProjectCreate"; value: boolean }
  | { key: "useAgentsSkillsPaths"; value: boolean };

export type DesktopActionPayloadMap = {
  "threads.collapse-all": EmptyActionPayload;
  "threads.filter": EmptyActionPayload;
  "project.add": { projectName?: string };
  "project.select": { projectId?: string | null; sessionPath?: string | null };
  "project.expand": { projectId: string };
  "project.collapse": { projectId: string };
  "project.actions": EmptyActionPayload;
  "project.open-in-file-manager": { projectId: string };
  "project.reorder": { projectIds: string[] };
  "project.pin": { projectId: string };
  "project.edit-name": { projectId: string; projectName: string };
  "project.inspect-repo": { projectId: string };
  "project.archive-threads": { projectId: string; projectName?: string };
  "project.remove-project": { projectId: string; projectName?: string };
  "project.create-worktree": EmptyActionPayload;
  "project.switch": EmptyActionPayload;
  "thread.new": { projectId?: string | null; sessionPath?: string | null };
  "thread.open": { projectId?: string | null; sessionPath?: string | null; threadId?: string };
  "thread.archive": { threadId: string };
  "thread.restore": { threadId: string };
  "thread.delete": { threadId: string };
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
  };
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
  error?: string;
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
