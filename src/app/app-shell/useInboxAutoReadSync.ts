import type { QueryClient } from '@tanstack/react-query'
import { type Dispatch, useEffect } from 'react'
import type { DesktopActionInvoker, InboxThread } from '../desktop/types'
import { desktopQueryKeys } from '../query/desktop-query'
import type { WorkspaceAction, WorkspaceState } from '../state/workspace'

type UseInboxAutoReadSyncInput = {
  dispatch: Dispatch<WorkspaceAction>
  inboxQueryIsSuccess: boolean
  inboxThreads: InboxThread[]
  invokeDesktopAction: DesktopActionInvoker
  loadProjectThreads: (projectId: string) => Promise<unknown>
  queryClient: QueryClient
  workspaceState: WorkspaceState
}

async function refreshInboxThreadState({
  loadProjectThreads,
  projectId,
  queryClient,
}: {
  loadProjectThreads: (projectId: string) => Promise<unknown>
  projectId: string
  queryClient: QueryClient
}) {
  await Promise.all([
    loadProjectThreads(projectId),
    queryClient.invalidateQueries({ queryKey: desktopQueryKeys.inboxThreads() }),
  ])
}

function markInboxThreadRead({
  invokeDesktopAction,
  loadProjectThreads,
  queryClient,
  thread,
  warningMessage,
}: {
  invokeDesktopAction: DesktopActionInvoker
  loadProjectThreads: (projectId: string) => Promise<unknown>
  queryClient: QueryClient
  thread: InboxThread
  warningMessage: string
}) {
  void invokeDesktopAction('inbox.mark-read', {
    projectId: thread.projectId,
    sessionPath: thread.sessionPath,
  })
    .then(async () => {
      await refreshInboxThreadState({
        loadProjectThreads,
        projectId: thread.projectId,
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
    selectedInboxSessionPath: string | null
  },
) {
  if (!input.inboxQueryIsSuccess) return
  if (input.inboxThreads.length === 0) {
    if (input.selectedInboxSessionPath !== null) {
      input.dispatch({ type: 'select-inbox-thread', sessionPath: null })
    }
    return
  }
  const selectedInboxThread = input.inboxThreads.find(
    (thread) => thread.sessionPath === input.selectedInboxSessionPath,
  )
  const visibleThread = selectedInboxThread ?? input.inboxThreads[0] ?? null
  if (!selectedInboxThread) {
    input.dispatch({ type: 'select-inbox-thread', sessionPath: visibleThread?.sessionPath ?? null })
  }
  if (input.activeView !== 'inbox' || !visibleThread?.unread) return
  markInboxThreadRead({
    invokeDesktopAction: input.invokeDesktopAction,
    loadProjectThreads: input.loadProjectThreads,
    queryClient: input.queryClient,
    thread: visibleThread,
    warningMessage: selectedInboxThread
      ? 'Failed to mark visible inbox thread read.'
      : 'Failed to auto-mark selected inbox thread read.',
  })
}

export function useInboxAutoReadSync({
  dispatch,
  inboxQueryIsSuccess,
  inboxThreads,
  invokeDesktopAction,
  loadProjectThreads,
  queryClient,
  workspaceState,
}: UseInboxAutoReadSyncInput) {
  const { activeView, selectedInboxSessionPath } = workspaceState

  useEffect(() => {
    syncInboxAutoReadSelection({
      dispatch,
      inboxQueryIsSuccess,
      inboxThreads,
      invokeDesktopAction,
      loadProjectThreads,
      queryClient,
      activeView,
      selectedInboxSessionPath,
    })
  }, [
    dispatch,
    inboxQueryIsSuccess,
    inboxThreads,
    invokeDesktopAction,
    loadProjectThreads,
    queryClient,
    activeView,
    selectedInboxSessionPath,
  ])
}
