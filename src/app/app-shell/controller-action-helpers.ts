import type { DesktopAction } from '../desktop/actions'
import type { AnyDesktopActionPayload, ArchivedThread } from '../desktop/types'
import type { WorkspaceState } from '../state/workspace'

export function buildContextualActionPayload({
  action,
  payload,
  composerProjectId,
  activeView,
  selectedSessionPath,
  selectedProjectEnvironmentId,
}: {
  action: DesktopAction
  payload: AnyDesktopActionPayload
  composerProjectId: string
  activeView: WorkspaceState['activeView']
  selectedSessionPath: string | null
  selectedProjectEnvironmentId: string | null
}) {
  return action === 'composer.model' ||
    action === 'composer.dequeue' ||
    action === 'composer.send' ||
    action === 'composer.stop' ||
    action === 'composer.thinking' ||
    action === 'thread.new' ||
    action === 'thread.open' ||
    action === 'workspace.commit' ||
    action === 'workspace.commit-options' ||
    action === 'workspace.diff-preferences'
    ? {
        projectId: composerProjectId,
        environmentId: selectedProjectEnvironmentId,
        sessionPath:
          action === 'thread.new'
            ? null
            : activeView === 'chat' || activeView === 'thread' || activeView === 'gitops'
              ? selectedSessionPath
              : null,
        composerMode: activeView === 'chat' ? 'chat' : 'code',
        ...payload,
      }
    : payload
}

export async function refreshArchivedThreadsIfOpen({
  archivedThreadsVisible,
  loadArchivedThreads,
  setArchivedThreads,
}: {
  archivedThreadsVisible: boolean
  loadArchivedThreads: () => Promise<ArchivedThread[]>
  setArchivedThreads: (threads: ArchivedThread[]) => void
}) {
  if (!archivedThreadsVisible) {
    return
  }

  setArchivedThreads(await loadArchivedThreads())
}
