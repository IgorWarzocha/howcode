import {
  getLocalDraftProjectId,
  getPersistedSessionPath,
  isLocalSessionPath,
} from '@howcode/shared/session-paths'
import type { DesktopEvent } from '../desktop/types'
import { desktopQueryKeys, invokeDesktopActionQuery } from '../query/desktop-query'
import type { WorkspaceState } from '../state/workspace'

type QueryClientLike = {
  setQueryData: (queryKey: readonly unknown[], updater: unknown) => void
  invalidateQueries: (filters: { queryKey: readonly unknown[] }) => Promise<unknown> | unknown
}

export type DesktopEventSelectionState = Pick<
  WorkspaceState,
  | 'activeView'
  | 'selectedProjectId'
  | 'selectedThreadId'
  | 'selectedSessionPath'
  | 'selectedInboxSessionPath'
>

export function getVisibleDesktopSessionPath(workspaceState: DesktopEventSelectionState) {
  return workspaceState.activeView === 'chat' ||
    workspaceState.activeView === 'thread' ||
    workspaceState.activeView === 'gitops' ||
    workspaceState.activeView === 'project'
    ? getPersistedSessionPath(workspaceState.selectedSessionPath)
    : workspaceState.activeView === 'inbox'
      ? (workspaceState.selectedInboxSessionPath ?? null)
      : null
}

export function shouldAutoOpenStartedThread({
  reason,
  projectId,
  workspaceState,
}: {
  reason: Extract<DesktopEvent, { type: 'thread-update' }>['reason']
  projectId: string
  isChat?: boolean | undefined
  workspaceState: DesktopEventSelectionState
}) {
  if (reason !== 'start' || projectId !== workspaceState.selectedProjectId) {
    return false
  }

  // Do not let background/runtime-host starts steal focus. User-initiated sends and explicit
  // thread creation open from their action result; ambient thread events should only update caches.
  return false
}

export function shouldDisplayStartedThreadForLocalDraft({
  reason,
  projectId,
  isChat,
  replacesSessionPath,
  workspaceState,
}: {
  reason: Extract<DesktopEvent, { type: 'thread-update' }>['reason']
  projectId: string
  isChat?: boolean | undefined
  replacesSessionPath?: string | null | undefined
  workspaceState: DesktopEventSelectionState
}) {
  const explicitlyReplacesSelectedDraft =
    isLocalSessionPath(replacesSessionPath) &&
    replacesSessionPath === workspaceState.selectedSessionPath
  if (reason !== 'start' && !explicitlyReplacesSelectedDraft) {
    return false
  }

  const localDraftProjectId = getLocalDraftProjectId(workspaceState.selectedSessionPath)
  if (localDraftProjectId !== projectId) {
    return false
  }

  return (
    (workspaceState.activeView === 'chat' && isChat === true) ||
    ((workspaceState.activeView === 'thread' || workspaceState.activeView === 'project') &&
      isChat !== true)
  )
}

export async function refreshVisibleInboxThread({
  event,
  loadProjectThreads,
  queryClient,
}: {
  event: Extract<DesktopEvent, { type: 'thread-update' }>
  loadProjectThreads: (projectId: string) => Promise<unknown>
  queryClient: QueryClientLike
}) {
  await invokeDesktopActionQuery('inbox.mark-read', {
    sessionPath: event.sessionPath,
    projectId: event.projectId,
  })

  await Promise.all([
    loadProjectThreads(event.projectId),
    queryClient.invalidateQueries({ queryKey: desktopQueryKeys.inboxThreads() }),
  ])
}

export function invalidateProjectWorktreeQueries({
  activeView,
  projectId,
  queryClient,
}: {
  activeView: WorkspaceState['activeView']
  projectId: string
  queryClient: QueryClientLike
}) {
  if (activeView === 'gitops') {
    void queryClient.invalidateQueries({
      queryKey: desktopQueryKeys.projectDiffPrefix(projectId),
    })
  }

  void queryClient.invalidateQueries({
    queryKey: desktopQueryKeys.projectDiffStatsPrefix(projectId),
  })

  void queryClient.invalidateQueries({
    queryKey: desktopQueryKeys.projectDiffImagePreviewPrefix(projectId),
  })

  void queryClient.invalidateQueries({
    queryKey: desktopQueryKeys.projectCommitsPrefix(projectId),
  })
}
