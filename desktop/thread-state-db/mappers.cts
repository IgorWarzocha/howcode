import type {
  ArchivedThread,
  Project,
  Thread,
  TurnDiffSummary,
} from "../../shared/desktop-contracts.ts";
import type { ArchivedThreadRow, ProjectRow, ThreadRow, TurnDiffRow } from "./types.cts";

export function formatRelativeAge(lastModifiedMs: number) {
  const elapsedMs = Math.max(0, Date.now() - lastModifiedMs);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;

  if (elapsedMs < hour) {
    return `${Math.max(1, Math.floor(elapsedMs / minute))}m`;
  }

  if (elapsedMs < day) {
    return `${Math.floor(elapsedMs / hour)}h`;
  }

  if (elapsedMs < week) {
    return `${Math.floor(elapsedMs / day)}d`;
  }

  if (elapsedMs < month) {
    return `${Math.floor(elapsedMs / week)}w`;
  }

  if (elapsedMs < year) {
    return `${Math.floor(elapsedMs / month)}mo`;
  }

  return `${Math.floor(elapsedMs / year)}y`;
}

export function mapProjectRow(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    threads: [],
    threadCount: row.threadCount,
    threadsLoaded: false,
    collapsed: Boolean(row.collapsed),
  };
}

export function mapThreadRow(row: ThreadRow): Thread {
  return {
    id: row.id,
    title: row.title,
    age: formatRelativeAge(row.lastModifiedMs),
    pinned: Boolean(row.pinned),
    sessionPath: row.sessionPath,
  };
}

export function mapArchivedThreadRow(row: ArchivedThreadRow): ArchivedThread {
  return {
    id: row.id,
    title: row.title,
    age: formatRelativeAge(row.lastModifiedMs),
    projectId: row.projectId,
    projectName: row.projectName,
    sessionPath: row.sessionPath,
  };
}

export function mapTurnDiffRow(row: TurnDiffRow): TurnDiffSummary {
  return {
    checkpointTurnCount: row.checkpointTurnCount,
    checkpointRef: row.checkpointRef,
    status: row.status,
    assistantMessageId: row.assistantMessageId ?? undefined,
    files: JSON.parse(row.filesJson),
    completedAt: row.completedAt,
  };
}
