import { getPersistedConversationId } from '@howcode/shared/conversation-ids'
import type { DesktopAction } from '../desktop/actions'
import type { AnyDesktopActionPayload, ArchivedChat } from '../desktop/types'
import { getGitRendererApi } from '../git-integration/client'
import type { WorkspaceState } from '../state/workspace-model'

function getContextualConversationId({
  activeView,
  payload,
  selectedConversationId,
}: {
  activeView: WorkspaceState['activeView']
  payload: AnyDesktopActionPayload
  selectedConversationId: string | null
}) {
  if (activeView === 'chat' || activeView === 'directory') {
    return selectedConversationId
  }

  return typeof payload.conversationId === 'string' ? payload.conversationId : null
}

function isContextualChatView(activeView: WorkspaceState['activeView']) {
  return activeView === 'chat' || activeView === 'directory'
}

function buildComposerSendPayload({
  composerProfile,
  composerDirectoryId,
  payload,
  selectedConversationId,
}: {
  composerProfile: WorkspaceState['composerProfile']
  composerDirectoryId: string
  payload: AnyDesktopActionPayload
  selectedConversationId: string | null
}) {
  const explicitPersistedConversationId =
    typeof payload.conversationId === 'string'
      ? getPersistedConversationId(payload.conversationId)
      : null
  if (explicitPersistedConversationId) {
    return {
      directoryId: composerDirectoryId,
      composerProfile,
      ...payload,
      conversationId: explicitPersistedConversationId,
    }
  }

  return {
    ...payload,
    directoryId: composerDirectoryId,
    conversationId: selectedConversationId,
    composerProfile,
  }
}

export function buildContextualActionPayload({
  action,
  payload,
  composerProfile,
  workspaceId,
  composerDirectoryId,
  activeView,
  selectedConversationId,
}: {
  action: DesktopAction
  composerProfile?: WorkspaceState['composerProfile']
  workspaceId?: string | null
  payload: AnyDesktopActionPayload
  composerDirectoryId: string
  activeView: WorkspaceState['activeView']
  selectedConversationId: string | null
}): AnyDesktopActionPayload {
  if (action === 'composer.send' && isContextualChatView(activeView)) {
    return buildComposerSendPayload({
      composerProfile: composerProfile ?? 'general',
      composerDirectoryId,
      payload,
      selectedConversationId,
    })
  }

  const gitPayload = getGitRendererApi()?.prepareGitActionPayload(action, payload, {
    composerDirectoryId,
    activeView,
    selectedConversationId,
    ...(composerProfile === undefined ? {} : { composerProfile }),
    ...(workspaceId === undefined ? {} : { workspaceId }),
  })
  if (gitPayload) return gitPayload

  return action === 'composer.model' ||
    action === 'composer.dequeue' ||
    action === 'composer.send' ||
    action === 'composer.stop' ||
    action === 'composer.thinking' ||
    action === 'chat.new' ||
    action === 'chat.open'
    ? {
        directoryId: composerDirectoryId,
        conversationId:
          action === 'chat.new'
            ? null
            : getContextualConversationId({ activeView, payload, selectedConversationId }),
        composerProfile: composerProfile ?? 'general',
        workspaceId,
        ...payload,
      }
    : payload
}

export async function refreshArchivedChatsIfOpen({
  archivedChatsVisible,
  loadArchivedChats,
  setArchivedChats,
}: {
  archivedChatsVisible: boolean
  loadArchivedChats: () => Promise<ArchivedChat[]>
  setArchivedChats: (chats: ArchivedChat[]) => void
}) {
  if (!archivedChatsVisible) {
    return
  }

  setArchivedChats(await loadArchivedChats())
}
