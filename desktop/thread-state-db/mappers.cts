import type {
  ArchivedThread,
  InboxThread,
  Project,
  Thread,
} from "../../shared/desktop-contracts.ts";
import type { ArchivedThreadRow, InboxThreadRow, ProjectRow, ThreadRow } from "./types.cts";

function parseStringArrayJson(value: string | null, context: string) {
  if (!value) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch (error) {
    console.warn(`Failed to parse ${context}.`, error);
    return [];
  }
}

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
    latestModifiedMs: row.latestModifiedMs,
    pinned: Boolean(row.pinned),
    threadCount: row.threadCount,
    threadsLoaded: false,
    collapsed: Boolean(row.collapsed),
    repoOriginUrl: row.repoOriginUrl,
    repoOriginChecked: Boolean(row.repoOriginChecked),
  };
}

export function mapThreadRow(row: ThreadRow): Thread {
  return {
    id: row.id,
    title: row.title,
    age: formatRelativeAge(row.lastModifiedMs),
    lastModifiedMs: row.lastModifiedMs,
    summary: row.summary ?? undefined,
    running: Boolean(row.running),
    unread: Boolean(row.unread),
    pinned: Boolean(row.pinned),
    sessionPath: row.sessionPath,
  };
}

export function mapInboxThreadRow(row: InboxThreadRow): InboxThread {
  return {
    threadId: row.threadId,
    title: row.title,
    projectId: row.projectId,
    projectName: row.projectName,
    sessionPath: row.sessionPath,
    age: formatRelativeAge(row.lastActivityMs),
    lastActivityMs: row.lastActivityMs,
    prompt: row.lastUserPrompt,
    content: parseStringArrayJson(row.lastAssistantMessageJson, `inbox thread ${row.sessionPath}`),
    preview: row.lastAssistantPreview,
    running: Boolean(row.running),
    unread: Boolean(row.unread),
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
