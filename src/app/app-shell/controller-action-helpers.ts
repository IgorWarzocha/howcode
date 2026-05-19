import type { DesktopAction } from '../desktop/actions'
import type { AnyDesktopActionPayload, ArchivedThread } from '../desktop/types'
import type { WorkspaceState } from '../state/workspace'

function getContextualSessionPath({
  activeView,
  payload,
  selectedSessionPath,
}: {
  activeView: WorkspaceState['activeView']
  payload: AnyDesktopActionPayload
  selectedSessionPath: string | null
}) {
  if (
    activeView === 'chat' ||
    activeView === 'thread' ||
    activeView === 'gitops' ||
    activeView === 'project'
  ) {
    return selectedSessionPath
  }

  return typeof payload.sessionPath === 'string' ? payload.sessionPath : null
}

function isContextualThreadView(activeView: WorkspaceState['activeView']) {
  return (
    activeView === 'chat' ||
    activeView === 'thread' ||
    activeView === 'gitops' ||
    activeView === 'project'
  )
}

export function buildContextualActionPayload({
  action,
  payload,
  composerProjectId,
  activeView,
  selectedSessionPath,
}: {
  action: DesktopAction
  payload: AnyDesktopActionPayload
  composerProjectId: string
  activeView: WorkspaceState['activeView']
  selectedSessionPath: string | null
}) {
  if (action === 'composer.send' && isContextualThreadView(activeView)) {
    return {
      ...payload,
      projectId: composerProjectId,
      sessionPath: selectedSessionPath,
      composerMode: activeView === 'chat' ? 'chat' : 'code',
    }
  }

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
        sessionPath:
          action === 'thread.new'
            ? null
            : getContextualSessionPath({ activeView, payload, selectedSessionPath }),
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
