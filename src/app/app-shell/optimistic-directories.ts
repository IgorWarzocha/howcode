import type { DesktopAction } from '../desktop/actions'
import type { ShellState } from '../desktop/types'
import {
  type ActionPayload,
  getPayloadChatId,
  getPayloadDirectoryId,
  sortPinnedChats,
  sortPinnedDirectories,
} from './controller-action-utils'

export function getOptimisticallyRenamedShellState(
  currentState: ShellState | null,
  payload: ActionPayload,
) {
  if (!currentState) {
    return null
  }

  const directoryId = getPayloadDirectoryId(payload)
  const directoryName =
    typeof payload.directoryName === 'string' ? payload.directoryName.trim() : ''

  if (!directoryId || directoryName.length === 0) {
    return currentState
  }

  return {
    ...currentState,
    directories: currentState.directories.map((directory) =>
      directory.id === directoryId ? { ...directory, name: directoryName } : directory,
    ),
  } satisfies ShellState
}

export function getOptimisticallyRenamedChatShellState(
  currentState: ShellState | null,
  payload: ActionPayload,
) {
  if (!currentState) return null
  const directoryId = getPayloadDirectoryId(payload)
  const chatId = getPayloadChatId(payload)
  const title = typeof payload.value === 'string' ? payload.value.trim() : ''
  if (!(directoryId && chatId && title)) return currentState

  return {
    ...currentState,
    directories: currentState.directories.map((directory) =>
      directory.id === directoryId
        ? {
            ...directory,
            chats: directory.chats.map((chat) => (chat.id === chatId ? { ...chat, title } : chat)),
          }
        : directory,
    ),
  } satisfies ShellState
}

export function getOptimisticallyPinnedShellState(
  currentState: ShellState | null,
  action: DesktopAction,
  payload: ActionPayload,
) {
  if (!currentState) {
    return null
  }

  if (action === 'chat.pin') {
    const directoryId = getPayloadDirectoryId(payload)
    const chatId = getPayloadChatId(payload)

    if (!(directoryId && chatId)) {
      return currentState
    }

    return {
      ...currentState,
      directories: currentState.directories.map((directory) => {
        if (directory.id !== directoryId) {
          return directory
        }

        const nextChats = sortPinnedChats(
          directory.chats.map((chat) =>
            chat.id === chatId ? { ...chat, pinned: !chat.pinned } : chat,
          ),
        )

        return {
          ...directory,
          chats: nextChats,
        }
      }),
    } satisfies ShellState
  }

  if (action === 'directory.pin') {
    const directoryId = getPayloadDirectoryId(payload)

    if (!directoryId) {
      return currentState
    }

    return {
      ...currentState,
      directories: sortPinnedDirectories(
        currentState.directories.map((directory) =>
          directory.id === directoryId ? { ...directory, pinned: !directory.pinned } : directory,
        ),
      ),
    } satisfies ShellState
  }

  return currentState
}
