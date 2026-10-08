import type { Dispatch } from 'react'
import { useEffect } from 'react'
import type { ArchivedChat } from '../../../../src/app/desktop/types'
import type {
  CodeChatSelection,
  WorkspaceAction,
  WorkspaceState,
} from '../../../../src/app/state/workspace-model'
import type { WorkingDirectory } from '../../../../src/app/types'
import { resolveCodeChatSelection } from './workspace-state'

type UseDirectoryShellSyncInput = {
  enabled?: boolean
  directories: WorkingDirectory[]
  collapsedDirectoryIds: Record<string, boolean>
  activeView: WorkspaceState['activeView']
  selectedDirectoryId: WorkspaceState['selectedDirectoryId']
  selectedChatId: WorkspaceState['selectedChatId']
  selectedConversationId: WorkspaceState['selectedConversationId']
  lastCodeChatSelection: CodeChatSelection | null
  loadDirectoryChats: (
    directoryId: string,
    options?: { replaceLocalDraftConversationId?: string | null },
  ) => Promise<unknown>
  loadArchivedChats: () => Promise<ArchivedChat[]>
  dispatch: Dispatch<WorkspaceAction>
  setArchivedChats: (chats: ArchivedChat[]) => void
}

export function useDirectoryShellSync({
  enabled = true,
  directories,
  collapsedDirectoryIds,
  activeView,
  selectedDirectoryId,
  selectedChatId,
  selectedConversationId,
  lastCodeChatSelection,
  loadDirectoryChats,
  loadArchivedChats,
  dispatch,
  setArchivedChats,
}: UseDirectoryShellSyncInput) {
  useEffect(() => {
    if (directories.length === 0) {
      return
    }

    const hasSelectedDirectory =
      !selectedDirectoryId || directories.some((directory) => directory.id === selectedDirectoryId)
    const hasSelectedChat =
      !selectedChatId ||
      directories.some((directory) => directory.chats.some((chat) => chat.id === selectedChatId))
    const hasSelectedSession =
      !selectedConversationId ||
      directories.some((directory) =>
        directory.chats.some((chat) => chat.conversationId === selectedConversationId),
      )

    const resolvedLastCodeChatSelection = resolveCodeChatSelection(
      directories,
      lastCodeChatSelection,
    )
    const hasSyncedRememberedCodeChat =
      resolvedLastCodeChatSelection?.directoryId === lastCodeChatSelection?.directoryId &&
      resolvedLastCodeChatSelection?.chatId === lastCodeChatSelection?.chatId &&
      resolvedLastCodeChatSelection?.conversationId === lastCodeChatSelection?.conversationId

    if (
      hasSelectedDirectory &&
      hasSelectedChat &&
      hasSelectedSession &&
      hasSyncedRememberedCodeChat
    ) {
      return
    }

    dispatch({ type: 'sync-directories', directories })
  }, [
    dispatch,
    lastCodeChatSelection,
    directories,
    selectedDirectoryId,
    selectedConversationId,
    selectedChatId,
  ])

  useEffect(() => {
    if (!enabled) return
    const expandedDirectories = directories.filter(
      (directory) => !(collapsedDirectoryIds[directory.id] || directory.chatsLoaded),
    )

    for (const directory of expandedDirectories) {
      void loadDirectoryChats(directory.id)
    }
  }, [enabled, collapsedDirectoryIds, loadDirectoryChats, directories])

  useEffect(() => {
    if (activeView !== 'archived') {
      return
    }

    let cancelled = false

    const syncArchivedChats = async () => {
      const nextArchivedChats = await loadArchivedChats()
      if (!cancelled) {
        setArchivedChats(nextArchivedChats)
      }
    }

    void syncArchivedChats()

    return () => {
      cancelled = true
    }
  }, [activeView, loadArchivedChats, setArchivedChats])
}
