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
  resolvedId?: string;
  name: string;
  threads: Thread[];
  latestModifiedMs?: number;
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
  images?: ToolResultImage[];
  isError: boolean;
};

export type ToolResultImage = {
  src: string;
  mimeType: string;
  alt: string;
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

export type ThreadData = {
  sessionPath: string;
  title: string;
  messages: Message[];
  previousMessageCount: number;
  isStreaming: boolean;
  isCompacting: boolean;
};
