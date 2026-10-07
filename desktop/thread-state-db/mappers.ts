import type { ArchivedThread, InboxThread, Thread } from '../../shared/desktop-contracts.ts'
import type { ArchivedThreadRow, InboxThreadRow, ThreadRow } from './types.ts'

export function formatRelativeAge(lastModifiedMs: number) {
  const elapsedMs = Math.max(0, Date.now() - lastModifiedMs)
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  const week = 7 * day
  const month = 30 * day
  const year = 365 * day

  if (elapsedMs < hour) {
    return `${Math.max(1, Math.floor(elapsedMs / minute))}m`
  }

  if (elapsedMs < day) {
    return `${Math.floor(elapsedMs / hour)}h`
  }

  if (elapsedMs < week) {
    return `${Math.floor(elapsedMs / day)}d`
  }

  if (elapsedMs < month) {
    return `${Math.floor(elapsedMs / week)}w`
  }

  if (elapsedMs < year) {
    return `${Math.floor(elapsedMs / month)}mo`
  }

  return `${Math.floor(elapsedMs / year)}y`
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
    conversationId: row.conversationId,
    branchName: row.branchName ?? undefined,
  }
}

export function mapInboxThreadRow(row: InboxThreadRow): InboxThread {
  return {
    threadId: row.threadId,
    title: row.title,
    projectId: row.projectId,
    projectName: row.projectName,
    conversationId: row.conversationId,
    age: formatRelativeAge(row.lastActivityMs),
    lastActivityMs: row.lastActivityMs,
    prompt: null,
    content: [],
    preview: row.lastAssistantPreview,
    running: Boolean(row.running),
    unread: Boolean(row.unread),
    branchName: row.branchName ?? undefined,
    isChat: Boolean(row.isChat),
  }
}

export function mapArchivedThreadRow(row: ArchivedThreadRow): ArchivedThread {
  return {
    id: row.id,
    title: row.title,
    age: formatRelativeAge(row.lastModifiedMs),
    projectId: row.projectId,
    projectName: row.projectName,
    conversationId: row.conversationId,
    isChat: Boolean(row.isChat),
  }
}
