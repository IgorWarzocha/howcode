import type { WorkspaceChat, WorkspaceNavigationState } from '../desktop/types'
import { mergeChatCacheFields } from './chat-cache-merge'

type ApplyWorkspaceChatOptions = {
  replaceConversationId?: string | null
}

function sameWorkspaceChat(
  left: WorkspaceChat,
  right: WorkspaceChat,
  replaceConversationId: string | null,
) {
  if (left.id === right.id) return true
  if (left.conversationId && right.conversationId && left.conversationId === right.conversationId)
    return true
  return Boolean(replaceConversationId && left.conversationId === replaceConversationId)
}

export function applyWorkspaceChatToSidebarState(
  currentState: WorkspaceNavigationState | null,
  chat: WorkspaceChat,
  options: ApplyWorkspaceChatOptions = {},
): WorkspaceNavigationState | null {
  if (!currentState) return currentState

  const replaceConversationId = options.replaceConversationId ?? null
  const targetWorkspaceId = chat.workspaceId ?? null
  const applyToChats = (chats: WorkspaceChat[], shouldInsert: boolean) => {
    const existingChat = chats.find((candidate) =>
      sameWorkspaceChat(candidate, chat, replaceConversationId),
    )
    const remainingChats = chats.filter(
      (candidate) => !sameWorkspaceChat(candidate, chat, replaceConversationId),
    )

    if (!shouldInsert) return remainingChats

    return [mergeChatCacheFields(existingChat, chat), ...remainingChats]
  }

  return {
    ...currentState,
    unassignedChats: applyToChats(currentState.unassignedChats, targetWorkspaceId === null),
    workspaces: currentState.workspaces.map((workspace) => ({
      ...workspace,
      chats: applyToChats(workspace.chats, workspace.id === targetWorkspaceId),
    })),
  }
}

export function removeChatFromSidebarState(
  currentState: WorkspaceNavigationState | null,
  conversationId: string,
): WorkspaceNavigationState | null {
  if (!currentState) return currentState

  return {
    ...currentState,
    unassignedChats: currentState.unassignedChats.filter(
      (chat) => chat.conversationId !== conversationId,
    ),
    workspaces: currentState.workspaces.map((workspace) => ({
      ...workspace,
      chats: workspace.chats.filter((chat) => chat.conversationId !== conversationId),
    })),
  }
}
