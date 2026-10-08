import type { DesktopAction } from '../../shared/desktop-actions.ts'
import type { AnyDesktopActionPayload } from '../../shared/desktop-contracts.ts'
import { getChatConversationId } from '../chat-repository.ts'
import {
  createWorkspace,
  moveChat,
  renameWorkspace,
  reorderWorkspaces,
  setWorkspaceCollapsed,
} from '../workspace-repository.ts'
import type { ActionHandlerResult } from './action-router-result.ts'
import { handledAction, unhandledAction } from './action-router-result.ts'

function getWorkspaceId(payload: AnyDesktopActionPayload) {
  return typeof payload.workspaceId === 'string' ? payload.workspaceId : null
}

function getWorkspaceIds(payload: AnyDesktopActionPayload) {
  return Array.isArray(payload.workspaceIds)
    ? payload.workspaceIds.filter((id): id is string => typeof id === 'string')
    : []
}

async function moveChatFromPayload(payload: AnyDesktopActionPayload) {
  const chatId = typeof payload.chatId === 'string' ? payload.chatId : null
  const conversationId =
    typeof payload.conversationId === 'string'
      ? payload.conversationId
      : chatId
        ? getChatConversationId(chatId)
        : null
  if (conversationId) moveChat(conversationId, getWorkspaceId(payload))
}

export async function handleWorkspaceDesktopAction(
  action: DesktopAction,
  payload: AnyDesktopActionPayload,
): Promise<ActionHandlerResult> {
  switch (action) {
    case 'workspace.create': {
      const name = typeof payload.value === 'string' ? payload.value : 'New workspace'
      createWorkspace(name)
      return handledAction()
    }
    case 'workspace.rename': {
      const workspaceId = getWorkspaceId(payload)
      const name = typeof payload.value === 'string' ? payload.value : ''
      if (workspaceId) renameWorkspace(workspaceId, name)
      return handledAction()
    }
    case 'workspace.reorder':
      reorderWorkspaces(getWorkspaceIds(payload))
      return handledAction()
    case 'workspace.collapse': {
      const workspaceId = getWorkspaceId(payload)
      if (workspaceId) setWorkspaceCollapsed(workspaceId, payload.value === true)
      return handledAction()
    }
    case 'chat.move': {
      await moveChatFromPayload(payload)
      return handledAction()
    }
    default:
      return unhandledAction()
  }
}
