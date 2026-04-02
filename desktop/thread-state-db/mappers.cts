import type { ArchivedThread, Project, Thread } from "../../shared/desktop-contracts";
import type {
  ArchivedThreadRow,
  CachedThread,
  CachedThreadRow,
  ProjectRow,
  ThreadRow,
} from "./types";

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

export function mapCachedThreadRow(row: CachedThreadRow): CachedThread {
  return {
    sessionPath: row.sessionPath,
    title: row.title,
    lastModifiedMs: row.lastModifiedMs,
    hydratedModifiedMs: row.hydratedModifiedMs,
    messages: row.messagesJson ? JSON.parse(row.messagesJson) : null,
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
