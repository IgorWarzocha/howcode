import type { AnyDesktopActionPayload, Chat, DesktopActionResult } from '../desktop/types'
import { hasDesktopBridgeQuery } from '../query/desktop-query'

export type ActionPayload = AnyDesktopActionPayload

export function getPayloadDirectoryId(payload: ActionPayload) {
  if (typeof payload.directoryId === 'string') return payload.directoryId
  return typeof payload.rootDirectoryId === 'string' ? payload.rootDirectoryId : null
}

export function getPayloadChatId(payload: ActionPayload) {
  return typeof payload.chatId === 'string' ? payload.chatId : null
}

export function getPayloadChatIds(payload: ActionPayload) {
  return Array.isArray(payload.chatIds)
    ? payload.chatIds.filter((chatId): chatId is string => typeof chatId === 'string')
    : []
}

export function getPayloadDirectoryIds(payload: ActionPayload) {
  return Array.isArray(payload.directoryIds)
    ? payload.directoryIds.filter(
        (directoryId): directoryId is string => typeof directoryId === 'string',
      )
    : []
}

export function getResultChatIds(chatIds: unknown) {
  return Array.isArray(chatIds)
    ? chatIds.filter((chatId): chatId is string => typeof chatId === 'string')
    : []
}

export function isChatList(value: unknown): value is Chat[] {
  return Array.isArray(value)
}

export function hasActionError(actionResult: DesktopActionResult | null | undefined) {
  return actionResult?.ok === false || typeof actionResult?.result?.error === 'string'
}

export function sortPinnedChats<T extends { id: string; pinned?: boolean | undefined }>(
  chats: T[],
) {
  return chats.toSorted((left, right) => {
    const leftPinned = Boolean(left.pinned)
    const rightPinned = Boolean(right.pinned)

    if (leftPinned !== rightPinned) {
      return leftPinned ? -1 : 1
    }

    return 0
  })
}

export function sortPinnedDirectories<T extends { id: string; pinned?: boolean | undefined }>(
  directories: T[],
) {
  return directories.toSorted((left, right) => {
    const leftPinned = Boolean(left.pinned)
    const rightPinned = Boolean(right.pinned)

    if (leftPinned !== rightPinned) {
      return leftPinned ? -1 : 1
    }

    return 0
  })
}

export function hasDesktopBridge() {
  return hasDesktopBridgeQuery()
}
