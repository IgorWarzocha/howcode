export type Thread = {
  id: string;
  title: string;
  age: string;
  lastModifiedMs?: number;
  sessionPath?: string;
  summary?: string;
  running?: boolean;
  unread?: boolean;
  pinned?: boolean;
};

export type InboxThread = {
  threadId: string;
  title: string;
  projectId: string;
  projectName: string;
  sessionPath: string;
  age: string;
  lastActivityMs?: number;
  prompt: string | null;
  content: string[];
  preview: string | null;
  running: boolean;
  unread: boolean;
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
  piTuiTakeover: boolean;
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

export type ProjectDiffBaseline =
  | { kind: "head" }
  | { kind: "previous" }
  | { kind: "last-opened"; rev: string; capturedAt?: string | null }
  | { kind: "yesterday" }
  | { kind: "main-branch" }
  | { kind: "dev-branch" }
  | { kind: "commit"; sha: string };

export type ProjectDiffResolvedBaseline = {
  kind: ProjectDiffBaseline["kind"];
  rev: string;
  label: string;
  commitSha: string | null;
  shortSha: string | null;
  subject: string | null;
  committedAt: string | null;
  capturedAt: string | null;
};

export type ProjectCommitEntry = {
  sha: string;
  shortSha: string;
  subject: string;
  authorName: string;
  authorEmail: string;
  authoredAt: string;
  committedAt: string;
  decorations: string[];
  isHead: boolean;
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
  fileCount: number;
  insertions: number;
  deletions: number;
  baseline: ProjectDiffBaseline;
  resolvedBaseline: ProjectDiffResolvedBaseline;
};

export type ProjectDiffStatsResult = {
  projectId: string;
  fileCount: number;
  insertions: number;
  deletions: number;
  baseline: ProjectDiffBaseline;
  resolvedBaseline: ProjectDiffResolvedBaseline;
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
      projectId: string | null;
      sessionPath: string | null;
      composer: ComposerState;
    };
