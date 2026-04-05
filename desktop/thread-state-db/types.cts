import type {
  TurnDiffFile,
  TurnDiffStatus,
  TurnDiffSummary,
} from "../../shared/desktop-contracts.ts";

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

export type TurnDiffRow = {
  sessionPath: string;
  checkpointTurnCount: number;
  checkpointRef: string;
  status: TurnDiffStatus;
  assistantMessageId: string | null;
  filesJson: string;
  completedAt: string;
};

export type TurnDiffSummaryRecord = {
  sessionPath: string;
  checkpointTurnCount: number;
  checkpointRef: string;
  status: TurnDiffStatus;
  assistantMessageId?: string;
  files: TurnDiffFile[];
  completedAt: string;
};

export type ThreadCwdRow = {
  cwd: string;
};
