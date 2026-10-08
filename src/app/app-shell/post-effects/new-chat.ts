import { upsertShellDirectory } from '@howcode/components/coding/ui'
import type { QueryClient } from '@tanstack/react-query'
import type { Dispatch } from 'react'
import type { ComposerState, DesktopActionResult } from '../../desktop/types'
import type { WorkspaceAction, WorkspaceState } from '../../state/workspace-model'
import {
  buildLocalChatFallback,
  buildOptimisticChat,
  getInitialChatBranchName,
} from '../chat-drafts'
import {
  type ActionPayload,
  getPayloadDirectoryId,
  hasDesktopBridge,
} from '../controller-action-utils'
import { applyDirectoryChatToShellState } from '../directory-chat-cache'

type NewChatPostEffectInput = {
  action: 'chat.new' | 'directory.add'
  contextualPayload: ActionPayload
  actionResult: DesktopActionResult | null
  workspaceState: WorkspaceState
  composerDirectoryId: string
  queryClient: QueryClient
  dispatch: Dispatch<WorkspaceAction>
  refreshShellState: () => Promise<unknown>
  loadDirectoryChats: (
    directoryId: string,
    options?: { replaceLocalDraftConversationId?: string | null },
  ) => Promise<unknown>
  loadComposerState: (request?: {
    directoryId?: string | null
    composerProfile?: 'general' | 'coding' | null
  }) => Promise<ComposerState | null>
  setComposerState: (state: ComposerState | null) => void
}

function getNewChatResult(input: NewChatPostEffectInput) {
  const directoryId = getPayloadDirectoryId(input.contextualPayload) ?? input.composerDirectoryId
  const resultDirectoryId =
    typeof input.actionResult?.result?.directoryId === 'string'
      ? input.actionResult.result.directoryId
      : null
  const conversationId =
    typeof input.actionResult?.result?.conversationId === 'string'
      ? input.actionResult.result.conversationId
      : null
  const chatId =
    typeof input.actionResult?.result?.chatId === 'string' ? input.actionResult.result.chatId : null
  const localFallback =
    !(chatId || conversationId) && directoryId && !hasDesktopBridge()
      ? buildLocalChatFallback(directoryId, {
          branchName: getInitialChatBranchName(input.contextualPayload.branchName),
        })
      : null
  return { directoryId, resultDirectoryId, conversationId, chatId, localFallback }
}

function shouldStayOnCodeDashboard(input: NewChatPostEffectInput) {
  return input.action === 'directory.add' && input.workspaceState.activeView === 'directory'
}

function shouldShowCodeDashboard(input: NewChatPostEffectInput) {
  return input.action === 'directory.add'
}

function getRequestedComposerProfile(input: NewChatPostEffectInput): 'general' | 'coding' {
  if (input.action === 'directory.add') return 'coding'
  if (input.contextualPayload.composerProfile === 'general') return 'general'
  if (input.contextualPayload.composerProfile === 'coding') return 'coding'
  return input.workspaceState.composerProfile
}

function getComposerProfileForNextView(input: NewChatPostEffectInput): 'general' | 'coding' {
  return getRequestedComposerProfile(input)
}

function applyOptimisticChat(
  input: NewChatPostEffectInput,
  chat: { directoryId: string; chatId: string; conversationId: string },
) {
  const optimisticChat = buildOptimisticChat({
    id: chat.chatId,
    conversationId: chat.conversationId,
    branchName: getInitialChatBranchName(input.contextualPayload.branchName),
  })
  applyDirectoryChatToShellState(input.queryClient, chat.directoryId, optimisticChat, {
    revealDirectory: true,
  })
  return optimisticChat
}

function openOptimisticChat(
  input: NewChatPostEffectInput,
  chat: { directoryId: string; chatId: string; conversationId: string },
) {
  const optimisticChat = applyOptimisticChat(input, chat)
  input.dispatch({
    type: 'open-chat',
    directoryId: chat.directoryId,
    chatId: chat.chatId,
    conversationId: chat.conversationId,
    composerProfile: getRequestedComposerProfile(input),
    workspaceId:
      typeof input.contextualPayload.workspaceId === 'string'
        ? input.contextualPayload.workspaceId
        : undefined,
  })
  return optimisticChat
}

function startOptimisticDirectoryChat(
  input: NewChatPostEffectInput,
  chat: { directoryId: string; chatId: string; conversationId: string },
) {
  const optimisticChat = applyOptimisticChat(input, chat)
  input.dispatch({
    type: 'start-directory-chat',
    directoryId: chat.directoryId,
    chatId: chat.chatId,
    conversationId: chat.conversationId,
  })
  return optimisticChat
}

async function handleNewChatBridgeResult(
  input: NewChatPostEffectInput,
  result: ReturnType<typeof getNewChatResult>,
) {
  const nextDirectoryId = result.resultDirectoryId ?? result.directoryId
  if (!(nextDirectoryId && result.chatId && result.conversationId)) return false
  if (shouldShowCodeDashboard(input)) {
    startOptimisticDirectoryChat(input, {
      directoryId: nextDirectoryId,
      chatId: result.chatId,
      conversationId: result.conversationId,
    })
    return true
  }
  const optimisticChat = openOptimisticChat(input, {
    directoryId: nextDirectoryId,
    chatId: result.chatId,
    conversationId: result.conversationId,
  })
  await input.loadDirectoryChats(nextDirectoryId, {})
  applyDirectoryChatToShellState(input.queryClient, nextDirectoryId, optimisticChat, {
    revealDirectory: true,
  })
  return true
}

async function handleNewChatNavigation(
  input: NewChatPostEffectInput,
  result: ReturnType<typeof getNewChatResult>,
) {
  const nextDirectoryId = result.resultDirectoryId ?? result.directoryId
  if (await handleNewChatBridgeResult(input, result)) return
  if (shouldStayOnCodeDashboard(input) && nextDirectoryId) {
    input.dispatch({ type: 'select-directory', directoryId: nextDirectoryId })
    return
  }
  if (result.localFallback) {
    openOptimisticChat(input, {
      directoryId: result.localFallback.directoryId,
      chatId: result.localFallback.chatId,
      conversationId: result.localFallback.conversationId,
    })
    return
  }
  if (nextDirectoryId) {
    input.dispatch({ type: 'select-directory', directoryId: nextDirectoryId })
    return
  }
  input.dispatch({ type: 'show-view', view: 'directories' })
}

export async function applyNewChatPostEffect(input: NewChatPostEffectInput) {
  const result = getNewChatResult(input)
  if (input.action === 'directory.add') {
    const directoryId = result.resultDirectoryId ?? result.directoryId
    if (directoryId) {
      const directoryName =
        typeof input.contextualPayload.directoryName === 'string'
          ? input.contextualPayload.directoryName
          : null
      upsertShellDirectory(
        input.queryClient,
        {
          id: directoryId,
          ...(directoryName ? { name: directoryName } : {}),
        },
        { reveal: true },
      )
    }
  }
  await handleNewChatNavigation(input, result)
  if (result.localFallback) return
  const nextComposerState =
    (input.action === 'chat.new' ? input.actionResult?.result?.composer : null) ??
    (await input.loadComposerState({
      directoryId: result.resultDirectoryId ?? result.directoryId,
      composerProfile: getComposerProfileForNextView(input),
    }))
  if (nextComposerState) input.setComposerState(nextComposerState)
}
