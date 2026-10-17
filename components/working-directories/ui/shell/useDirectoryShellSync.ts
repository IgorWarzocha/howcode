import type { Dispatch } from 'react'
import { useEffect } from 'react'
import type { ArchivedChat } from '../../../../src/app/desktop/types'
import type {
  ChatSelection,
  WorkspaceAction,
  WorkspaceState,
} from '../../../../src/app/state/workspace-model'
import type { WorkingDirectory } from '../../../../src/app/types'
import { resolveChatSelection } from './workspace-state'

type UseDirectoryShellSyncInput = {
  enabled?: boolean
  directories: WorkingDirectory[]
  collapsedDirectoryIds: Record<string, boolean>
  activeView: WorkspaceState['activeView']
  selectedDirectoryId: WorkspaceState['selectedDirectoryId']
  selectedConversationId: WorkspaceState['selectedConversationId']
  lastChatSelection: ChatSelection | null
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
  selectedConversationId,
  lastChatSelection,
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
      Boolean(selectedConversationId) ||
      !selectedDirectoryId ||
      directories.some((directory) => directory.id === selectedDirectoryId)

    const resolvedLastChatSelection = resolveChatSelection(directories, lastChatSelection)
    const hasSyncedRememberedChat =
      resolvedLastChatSelection?.directoryId === lastChatSelection?.directoryId &&
      resolvedLastChatSelection?.chatId === lastChatSelection?.chatId &&
      resolvedLastChatSelection?.conversationId === lastChatSelection?.conversationId

    if (hasSelectedDirectory && hasSyncedRememberedChat) {
      return
    }

    dispatch({ type: 'sync-directories', directories })
  }, [dispatch, lastChatSelection, directories, selectedDirectoryId, selectedConversationId])

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
