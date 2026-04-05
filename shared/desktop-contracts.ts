import type { DesktopAction } from "./desktop-actions";

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
  favoriteFolders: string[];
  projectImportState: boolean | null;
  projectScanRoots: string[];
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

export type DesktopActionPayload = Record<string, unknown>;

export type DesktopActionResult = {
  ok: boolean;
  at: string;
  payload: {
    action: DesktopAction;
    payload: DesktopActionPayload;
  };
  result?: Record<string, unknown> | null;
};
