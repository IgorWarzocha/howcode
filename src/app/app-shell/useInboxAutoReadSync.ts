import type { QueryClient } from '@tanstack/react-query'
import { type Dispatch, useEffect } from 'react'
import type { DesktopActionInvoker, InboxChat } from '../desktop/types'
import { desktopQueryKeys } from '../query/desktop-query'
import type { WorkspaceAction, WorkspaceState } from '../state/workspace-model'

type UseInboxAutoReadSyncInput = {
  dispatch: Dispatch<WorkspaceAction>
  inboxQueryIsSuccess: boolean
  inboxChats: InboxChat[]
  invokeDesktopAction: DesktopActionInvoker
  loadDirectoryChats: (directoryId: string) => Promise<unknown>
  queryClient: QueryClient
  workspaceState: WorkspaceState
}

async function refreshInboxChatState({
  loadDirectoryChats,
  directoryId,
  queryClient,
}: {
  loadDirectoryChats: (directoryId: string) => Promise<unknown>
  directoryId: string
  queryClient: QueryClient
}) {
  await Promise.all([
    loadDirectoryChats(directoryId),
    queryClient.invalidateQueries({ queryKey: desktopQueryKeys.inboxChats() }),
  ])
}

function markInboxChatRead({
  invokeDesktopAction,
  loadDirectoryChats,
  queryClient,
  chat,
  warningMessage,
}: {
  invokeDesktopAction: DesktopActionInvoker
  loadDirectoryChats: (directoryId: string) => Promise<unknown>
  queryClient: QueryClient
  chat: InboxChat
  warningMessage: string
}) {
  void invokeDesktopAction('inbox.mark-read', {
    directoryId: chat.directoryId,
    conversationId: chat.conversationId,
  })
    .then(async () => {
      await refreshInboxChatState({
        loadDirectoryChats,
        directoryId: chat.directoryId,
        queryClient,
      })
    })
    .catch((error) => {
      console.warn(warningMessage, error)
    })
}

function syncInboxAutoReadSelection(
  input: Omit<UseInboxAutoReadSyncInput, 'workspaceState'> & {
    activeView: WorkspaceState['activeView']
    selectedInboxConversationId: string | null
  },
) {
  if (!input.inboxQueryIsSuccess) return
  if (input.inboxChats.length === 0) {
    if (input.selectedInboxConversationId !== null) {
      input.dispatch({ type: 'select-inbox-chat', conversationId: null })
    }
    return
  }
  const selectedInboxChat = input.inboxChats.find(
    (chat) => chat.conversationId === input.selectedInboxConversationId,
  )
  const visibleChat = selectedInboxChat ?? input.inboxChats[0] ?? null
  if (!selectedInboxChat) {
    input.dispatch({
      type: 'select-inbox-chat',
      conversationId: visibleChat?.conversationId ?? null,
    })
  }
  if (input.activeView !== 'inbox' || !visibleChat?.unread) return
  markInboxChatRead({
    invokeDesktopAction: input.invokeDesktopAction,
    loadDirectoryChats: input.loadDirectoryChats,
    queryClient: input.queryClient,
    chat: visibleChat,
    warningMessage: selectedInboxChat
      ? 'Failed to mark visible inbox chat read.'
      : 'Failed to auto-mark selected inbox chat read.',
  })
}

export function useInboxAutoReadSync({
  dispatch,
  inboxQueryIsSuccess,
  inboxChats,
  invokeDesktopAction,
  loadDirectoryChats,
  queryClient,
  workspaceState,
}: UseInboxAutoReadSyncInput) {
  const { activeView, selectedInboxConversationId } = workspaceState

  useEffect(() => {
    syncInboxAutoReadSelection({
      dispatch,
      inboxQueryIsSuccess,
      inboxChats,
      invokeDesktopAction,
      loadDirectoryChats,
      queryClient,
      activeView,
      selectedInboxConversationId,
    })
  }, [
    dispatch,
    inboxQueryIsSuccess,
    inboxChats,
    invokeDesktopAction,
    loadDirectoryChats,
    queryClient,
    activeView,
    selectedInboxConversationId,
  ])
}
