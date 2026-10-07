import { getPersistedConversationId } from '@howcode/shared/conversation-ids'
import type { DesktopAction } from '../desktop/actions'
import type { AnyDesktopActionPayload, ArchivedThread } from '../desktop/types'
import type { WorkspaceState } from '../state/workspace'

function getContextualConversationId({
  activeView,
  payload,
  selectedConversationId,
}: {
  activeView: WorkspaceState['activeView']
  payload: AnyDesktopActionPayload
  selectedConversationId: string | null
}) {
  if (
    activeView === 'chat' ||
    activeView === 'thread' ||
    activeView === 'gitops' ||
    activeView === 'project'
  ) {
    return selectedConversationId
  }

  return typeof payload.conversationId === 'string' ? payload.conversationId : null
}

function isContextualThreadView(activeView: WorkspaceState['activeView']) {
  return (
    activeView === 'chat' ||
    activeView === 'thread' ||
    activeView === 'gitops' ||
    activeView === 'project'
  )
}

function buildComposerSendPayload({
  activeView,
  composerProjectId,
  payload,
  selectedConversationId,
}: {
  activeView: WorkspaceState['activeView']
  composerProjectId: string
  payload: AnyDesktopActionPayload
  selectedConversationId: string | null
}) {
  const composerMode = activeView === 'chat' ? 'chat' : 'code'
  const explicitPersistedConversationId =
    typeof payload.conversationId === 'string'
      ? getPersistedConversationId(payload.conversationId)
      : null
  if (explicitPersistedConversationId) {
    return {
      projectId: composerProjectId,
      composerMode,
      ...payload,
      conversationId: explicitPersistedConversationId,
    }
  }

  return {
    ...payload,
    projectId: composerProjectId,
    conversationId: selectedConversationId,
    composerMode,
  }
}

export function buildContextualActionPayload({
  action,
  payload,
  composerProjectId,
  activeView,
  selectedConversationId,
}: {
  action: DesktopAction
  payload: AnyDesktopActionPayload
  composerProjectId: string
  activeView: WorkspaceState['activeView']
  selectedConversationId: string | null
}) {
  if (action === 'composer.send' && isContextualThreadView(activeView)) {
    return buildComposerSendPayload({
      activeView,
      composerProjectId,
      payload,
      selectedConversationId,
    })
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
        conversationId:
          action === 'thread.new'
            ? null
            : getContextualConversationId({ activeView, payload, selectedConversationId }),
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
