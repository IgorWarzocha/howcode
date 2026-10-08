import type { ArchivedChat, Chat, InboxChat } from '../../shared/desktop-contracts.ts'
import type { ArchivedChatRow, ChatRow, InboxChatRow } from './types.ts'

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

export function mapChatRow(row: ChatRow): Chat {
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

export function mapInboxChatRow(row: InboxChatRow): InboxChat {
  return {
    chatId: row.chatId,
    title: row.title,
    directoryId: row.directoryId,
    directoryName: row.directoryName,
    conversationId: row.conversationId,
    age: formatRelativeAge(row.lastActivityMs),
    lastActivityMs: row.lastActivityMs,
    prompt: null,
    content: [],
    preview: row.lastAssistantPreview,
    running: Boolean(row.running),
    unread: Boolean(row.unread),
    branchName: row.branchName ?? undefined,
    composerProfile: row.isChat ? 'general' : 'coding',
  }
}

export function mapArchivedChatRow(row: ArchivedChatRow): ArchivedChat {
  return {
    id: row.id,
    title: row.title,
    age: formatRelativeAge(row.lastModifiedMs),
    directoryId: row.directoryId,
    directoryName: row.directoryName,
    conversationId: row.conversationId,
    composerProfile: row.isChat ? 'general' : 'coding',
  }
}
