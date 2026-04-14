export type SessionSummaryRecord = {
  id: string;
  cwd: string;
  sessionPath: string;
  title: string;
  lastModifiedMs: number;
};

export type ProjectRow = {
  id: string;
  name: string;
  orderIndex: number | null;
  pinned: number;
  collapsed: number;
  threadCount: number;
  latestModifiedMs: number;
  repoOriginUrl: string | null;
  repoOriginChecked: number;
};

export type ThreadRow = {
  id: string;
  title: string;
  sessionPath: string;
  summary: string | null;
  running: number;
  unread: number;
  pinned: number;
  lastModifiedMs: number;
};

export type InboxThreadRow = {
  threadId: string;
  title: string;
  projectId: string;
  projectName: string;
  sessionPath: string;
  lastUserPrompt: string | null;
  lastAssistantMessageJson: string | null;
  lastAssistantPreview: string | null;
  running: number;
  unread: number;
  lastActivityMs: number;
};

export type ThreadInboxMessageRecord = {
  sessionPath: string;
  userPrompt: string | null;
  content: string[];
  preview: string | null;
  lastAssistantAtMs: number;
};

export type InboxPathRow = {
  sessionPath: string;
};

export type ThreadAssistantSnapshotRow = {
  messageJson: string | null;
  preview: string | null;
};

export type ArchivedThreadRow = {
  id: string;
  title: string;
  sessionPath: string;
  projectId: string;
  projectName: string;
  lastModifiedMs: number;
};

export type ThreadPathRow = {
  sessionPath: string;
};

export type ThreadCwdRow = {
  cwd: string;
};
