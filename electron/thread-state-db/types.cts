import type { Message } from "../../shared/desktop-contracts.js";

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
  collapsed: number;
  threadCount: number;
  latestModifiedMs: number;
};

export type ThreadRow = {
  id: string;
  title: string;
  sessionPath: string;
  pinned: number;
  lastModifiedMs: number;
};

export type CachedThreadRow = {
  sessionPath: string;
  title: string;
  lastModifiedMs: number;
  hydratedModifiedMs: number | null;
  messagesJson: string | null;
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

export type CachedThread = {
  sessionPath: string;
  title: string;
  lastModifiedMs: number;
  hydratedModifiedMs: number | null;
  messages: Message[] | null;
};
