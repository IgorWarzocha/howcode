import { getLocalDraftBranchName, isLocalConversationId } from '@howcode/shared/conversation-ids'
import type {
  Chat,
  ChatData,
  DesktopActionResult,
  DesktopEvent,
  WorkspaceNavigationState,
} from '../desktop/types'
import { forgetLocalDraftChat } from '../hooks/useDesktopDirectoryChats'
import type { WorkspaceAction, WorkspaceState } from '../state/workspace-model'
import {
  buildLocalChatFallback,
  buildOptimisticChat,
  getInitialChatBranchName,
} from './chat-drafts'
import type { ActionPayload } from './controller-action-utils'
import { getPayloadDirectoryId, hasActionError } from './controller-action-utils'
import {
  applyDirectoryChatToShellState,
  getDraftReplacementConversationId,
  removeDirectoryChatFromShellState,
} from './directory-chat-cache'
import {
  applyWorkspaceChatToSidebarState,
  removeChatFromSidebarState,
} from './workspace-navigation-cache'

type QueryClientLike = Parameters<typeof applyDirectoryChatToShellState>[0] & {
  getQueryData?: (queryKey: readonly unknown[]) => unknown
}

type DispatchWorkspaceAction = (action: WorkspaceAction) => void

type SetWorkspaceNavigationState = (
  updater: (state: WorkspaceNavigationState | null) => WorkspaceNavigationState | null,
) => void

type SetLiveChatData = (updater: (state: ChatData | null) => ChatData | null) => void

type OptimisticComposerChatResult = {
  contextualPayload: ActionPayload
}

function getContextualWorkspaceId(payload: ActionPayload) {
  return typeof payload.workspaceId === 'string' ? payload.workspaceId : null
}

function upsertSidebarChat({
  queryClient,
  setWorkspaceNavigationState,
  directoryId,
  chat,
  workspaceId,
  updateDirectoryChats = true,
  replaceConversationId = null,
  revealDirectory = false,
}: {
  queryClient: QueryClientLike
  setWorkspaceNavigationState: SetWorkspaceNavigationState
  directoryId: string
  chat: Chat
  workspaceId?: string | null | undefined
  updateDirectoryChats?: boolean | undefined
  replaceConversationId?: string | null | undefined
  revealDirectory?: boolean | undefined
}) {
  if (updateDirectoryChats) {
    applyDirectoryChatToShellState(queryClient, directoryId, chat, {
      replaceConversationId,
      revealDirectory,
    })
  }

  if (workspaceId !== undefined) {
    setWorkspaceNavigationState((current) =>
      applyWorkspaceChatToSidebarState(
        current,
        {
          ...chat,
          directoryId,
          workspaceId: workspaceId,
        },
        { replaceConversationId },
      ),
    )
  }
}

function getCachedChatTitle(
  queryClient: QueryClientLike,
  directoryId: string,
  chatId: string,
  conversationId: string,
) {
  const shellState = queryClient.getQueryData?.(['desktop', 'shellState']) as
    | {
        directories?: Array<{
          id: string
          chats: Array<{
            id: string
            conversationId?: string | null
            title?: string
          }>
        }>
      }
    | null
    | undefined

  return (
    shellState?.directories
      ?.find((candidate) => candidate.id === directoryId)
      ?.chats.find(
        (candidate) => candidate.id === chatId || candidate.conversationId === conversationId,
      )?.title ?? null
  )
}

export function applyOptimisticComposerChat({
  activeView,
  contextualPayload,
  queryClient,
  dispatch,
  setWorkspaceNavigationState,
  setLiveChatData,
}: {
  activeView: WorkspaceState['activeView']
  contextualPayload: ActionPayload
  queryClient: QueryClientLike
  dispatch: DispatchWorkspaceAction
  setWorkspaceNavigationState: SetWorkspaceNavigationState
  setLiveChatData: SetLiveChatData
}): OptimisticComposerChatResult {
  if (
    activeView === 'inbox' ||
    typeof contextualPayload.directoryId !== 'string' ||
    contextualPayload.conversationId
  ) {
    return { contextualPayload }
  }

  const workspaceId = getContextualWorkspaceId(contextualPayload)
  const branchName = getInitialChatBranchName(contextualPayload.branchName)
  const localFallback = buildLocalChatFallback(contextualPayload.directoryId, {
    workspaceId,
    branchName,
  })
  const nextPayload = { ...contextualPayload, conversationId: localFallback.conversationId }
  const chat = buildOptimisticChat({
    id: localFallback.chatId,
    conversationId: localFallback.conversationId,
    branchName: getLocalDraftBranchName(localFallback.conversationId),
    running: true,
  })

  upsertSidebarChat({
    queryClient,
    setWorkspaceNavigationState,
    directoryId: localFallback.directoryId,
    chat,
    workspaceId,
    revealDirectory: true,
  })
  setLiveChatData(() => ({
    conversationId: localFallback.conversationId,
    title: 'New chat',
    messages: [],
    previousMessageCount: 0,
    isStreaming: true,
    isCompacting: false,
  }))
  dispatch({
    type: 'open-chat',
    directoryId: localFallback.directoryId,
    chatId: localFallback.chatId,
    conversationId: localFallback.conversationId,
    composerExtensions: Array.isArray(contextualPayload.composerExtensions)
      ? contextualPayload.composerExtensions.filter(
          (name): name is string => typeof name === 'string',
        )
      : undefined,
  })

  return { contextualPayload: nextPayload }
}

export function removeFailedOptimisticComposerChat({
  contextualPayload,
  queryClient,
  setWorkspaceNavigationState,
  setLiveChatData,
}: {
  contextualPayload: ActionPayload
  queryClient: QueryClientLike
  setWorkspaceNavigationState: SetWorkspaceNavigationState
  setLiveChatData?: SetLiveChatData
}) {
  const directoryId = getPayloadDirectoryId(contextualPayload)
  const conversationId =
    typeof contextualPayload.conversationId === 'string' ? contextualPayload.conversationId : null

  if (!(directoryId && conversationId && isLocalConversationId(conversationId))) return

  removeDirectoryChatFromShellState(queryClient, directoryId, conversationId)
  setWorkspaceNavigationState((current) => removeChatFromSidebarState(current, conversationId))
  setLiveChatData?.((current) => (current?.conversationId === conversationId ? null : current))
}

export function reconcileComposerChatResult({
  contextualPayload,
  actionResult,
  workspaceState,
  queryClient,
  dispatch,
  setWorkspaceNavigationState,
  setLiveChatData,
}: {
  contextualPayload: ActionPayload
  actionResult: DesktopActionResult | null
  workspaceState: WorkspaceState
  queryClient: QueryClientLike
  dispatch: DispatchWorkspaceAction
  setWorkspaceNavigationState: SetWorkspaceNavigationState
  setLiveChatData: SetLiveChatData
}) {
  if (hasActionError(actionResult)) {
    removeFailedOptimisticComposerChat({
      contextualPayload,
      queryClient,
      setWorkspaceNavigationState,
      setLiveChatData,
    })
    return
  }

  const directoryId = getPayloadDirectoryId(contextualPayload)
  const submittedConversationId =
    typeof contextualPayload.conversationId === 'string' ? contextualPayload.conversationId : null
  const resultConversationId =
    typeof actionResult?.result?.composerSendConversationId === 'string'
      ? actionResult.result.composerSendConversationId
      : null
  const resultChatId =
    typeof actionResult?.result?.composerSendChatId === 'string'
      ? actionResult.result.composerSendChatId
      : null
  const sendOutcome = actionResult?.result?.composerSendOutcome

  if (
    !(directoryId && resultConversationId && resultChatId) ||
    (submittedConversationId && !isLocalConversationId(submittedConversationId))
  ) {
    if (sendOutcome === 'stopped') {
      removeFailedOptimisticComposerChat({
        contextualPayload,
        queryClient,
        setWorkspaceNavigationState,
        setLiveChatData,
      })
    }
    return
  }

  const title = getCachedChatTitle(queryClient, directoryId, resultChatId, resultConversationId)
  const replaceConversationId = isLocalConversationId(submittedConversationId)
    ? submittedConversationId
    : null
  if (replaceConversationId) forgetLocalDraftChat(directoryId, replaceConversationId)
  upsertSidebarChat({
    queryClient,
    setWorkspaceNavigationState,
    directoryId,
    chat: buildOptimisticChat({
      id: resultChatId,
      title: title ?? 'New chat',
      conversationId: resultConversationId,
      branchName: getLocalDraftBranchName(submittedConversationId),
    }),
    workspaceId:
      workspaceState.activeView === 'chat'
        ? getContextualWorkspaceId(contextualPayload)
        : undefined,
    replaceConversationId,
    revealDirectory: true,
  })
  setLiveChatData((current) =>
    current?.conversationId === submittedConversationId
      ? {
          ...current,
          conversationId: resultConversationId,
          title: title ?? current.title,
        }
      : current,
  )
  dispatch({
    type: 'open-chat',
    directoryId,
    chatId: resultChatId,
    conversationId: resultConversationId,
  })
}

export function applyChatEventToSidebarState({
  event,
  workspaceState,
  queryClient,
  setWorkspaceNavigationState,
}: {
  event: Extract<DesktopEvent, { type: 'chat-update' }>
  workspaceState: Pick<
    WorkspaceState,
    'activeView' | 'selectedDirectoryId' | 'selectedConversationId'
  >
  queryClient: QueryClientLike
  setWorkspaceNavigationState: SetWorkspaceNavigationState
}) {
  const eventReplacementConversationId =
    typeof event.replacesConversationId === 'string' ? event.replacesConversationId : null
  const explicitReplacementConversationId = isLocalConversationId(eventReplacementConversationId)
    ? eventReplacementConversationId
    : null
  const replaceConversationId =
    explicitReplacementConversationId ??
    (event.reason === 'start'
      ? getDraftReplacementConversationId(
          workspaceState.selectedConversationId,
          workspaceState.selectedDirectoryId,
          event.directoryId,
        )
      : null)
  const directoryChatScopeMatchesView = workspaceState.activeView !== 'inbox'
  if (replaceConversationId) forgetLocalDraftChat(event.directoryId, replaceConversationId)
  upsertSidebarChat({
    queryClient,
    setWorkspaceNavigationState,
    directoryId: event.directoryId,
    chat: buildOptimisticChat({
      id: event.chatId,
      title: event.chat.title,
      conversationId: event.conversationId,
      branchName: event.branchName,
      running: event.chat.isStreaming || event.chat.isCompacting,
    }),
    workspaceId: event.workspaceId,
    updateDirectoryChats: directoryChatScopeMatchesView,
    replaceConversationId,
  })
}
