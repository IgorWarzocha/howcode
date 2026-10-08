import { isLocalConversationId } from '@howcode/shared/conversation-ids'
import type { Dispatch, SetStateAction } from 'react'
import type { ChatData, DesktopEvent } from '../../desktop/types'
import { desktopQueryKeys } from '../../query/desktop-query'
import type { WorkspaceAction } from '../../state/workspace-model'
import {
  type DesktopEventSelectionState,
  getVisibleDesktopConversationId,
  refreshVisibleInboxChat,
  shouldAutoOpenStartedChat,
  shouldDisplayStartedChatForLocalDraft,
} from '../desktop-event-sync'
import { applyChatEventToSidebarState } from '../sidebar-chat-sync'
import type { DesktopEventQueryClient, DesktopEventSyncRuntime } from './runtime'

function mergeChatPreferences(input: {
  event: Extract<DesktopEvent, { type: 'chat-update' }>
  queryClient: DesktopEventQueryClient
}) {
  let chatWithPreferences = input.event.chat
  let hadCachedChat = false
  input.queryClient.setQueryData(
    desktopQueryKeys.chat(input.event.conversationId),
    (current: unknown) => {
      const currentChat = current as ChatData | null | undefined
      hadCachedChat = Boolean(currentChat)
      chatWithPreferences = {
        ...input.event.chat,
        diffPreferences: input.event.chat.diffPreferences ?? currentChat?.diffPreferences,
      }
      return chatWithPreferences
    },
  )
  if (!(input.event.chat.diffPreferences || hadCachedChat)) {
    void input.queryClient.invalidateQueries({
      queryKey: desktopQueryKeys.chatPrefix(input.event.conversationId),
    })
  }
  return chatWithPreferences
}

function getChatEventFlags(input: {
  event: Extract<DesktopEvent, { type: 'chat-update' }>
  latestWorkspaceState: DesktopEventSelectionState
  visibleConversationId: string | null
}) {
  const shouldAutoOpenChat = shouldAutoOpenStartedChat({
    reason: input.event.reason,
    directoryId: input.event.directoryId,
    composerProfile: input.event.composerProfile,
    workspaceState: input.latestWorkspaceState,
  })
  const shouldDisplayLocalDraftChat = shouldDisplayStartedChatForLocalDraft({
    reason: input.event.reason,
    directoryId: input.event.directoryId,
    composerProfile: input.event.composerProfile,
    replacesConversationId: input.event.replacesConversationId,
    workspaceState: input.latestWorkspaceState,
  })
  return {
    hasVisibleAssistantActivity: input.event.chat.messages.some(
      (message) => message.role !== 'user',
    ),
    isCompactionChatUpdate:
      input.event.reason === 'compaction-start' || input.event.reason === 'compaction',
    isVisibleChatUpdate: input.event.conversationId === input.visibleConversationId,
    shouldAutoOpenChat,
    shouldDisplayLocalDraftChat,
  }
}

function updateLiveChatData(input: {
  aliasedLocalDraftConversationId: string | null
  event: Extract<DesktopEvent, { type: 'chat-update' }>
  flags: ReturnType<typeof getChatEventFlags>
  setLiveChatData: Dispatch<SetStateAction<ChatData | null>>
  chatWithPreferences: ChatData
}) {
  input.setLiveChatData((current) => {
    const shouldApplyLiveChat =
      input.flags.isVisibleChatUpdate ||
      input.flags.shouldAutoOpenChat ||
      input.aliasedLocalDraftConversationId === current?.conversationId ||
      current?.conversationId === input.event.conversationId
    if (!shouldApplyLiveChat) return current
    const shouldSuppressFirstTurnTimeline =
      !input.flags.hasVisibleAssistantActivity &&
      (input.aliasedLocalDraftConversationId === current?.conversationId ||
        (input.flags.isVisibleChatUpdate &&
          current?.isStreaming === true &&
          current.messages.length === 0))
    return {
      ...input.chatWithPreferences,
      messages: shouldSuppressFirstTurnTimeline ? [] : input.chatWithPreferences.messages,
      conversationId:
        input.aliasedLocalDraftConversationId && !input.flags.hasVisibleAssistantActivity
          ? input.aliasedLocalDraftConversationId
          : input.chatWithPreferences.conversationId,
      diffPreferences: input.chatWithPreferences.diffPreferences ?? current?.diffPreferences,
    }
  })
}

function dispatchChatOpenIfNeeded(input: {
  dispatch: Dispatch<WorkspaceAction>
  event: Extract<DesktopEvent, { type: 'chat-update' }>
  flags: ReturnType<typeof getChatEventFlags>
  latestWorkspaceState: DesktopEventSelectionState
}) {
  if (
    input.flags.shouldDisplayLocalDraftChat &&
    input.latestWorkspaceState.activeView === 'directory'
  ) {
    input.dispatch({
      type: 'start-directory-chat',
      directoryId: input.event.directoryId,
      chatId: input.event.chatId,
      conversationId: input.event.conversationId,
    })
    return
  }

  if (
    input.flags.shouldAutoOpenChat ||
    (input.flags.shouldDisplayLocalDraftChat && input.flags.hasVisibleAssistantActivity)
  ) {
    input.dispatch({
      type: 'open-chat',
      directoryId: input.event.directoryId,
      chatId: input.event.chatId,
      conversationId: input.event.conversationId,
      composerProfile: input.event.composerProfile ?? 'coding',
    })
    return
  }
  if (
    input.flags.isVisibleChatUpdate &&
    input.latestWorkspaceState.selectedChatId !== input.event.chatId &&
    input.latestWorkspaceState.activeView === 'chat'
  ) {
    input.dispatch({
      type: 'open-chat',
      directoryId: input.event.directoryId,
      chatId: input.event.chatId,
      conversationId: input.event.conversationId,
      composerProfile: input.latestWorkspaceState.composerProfile,
    })
  }
}

function refreshChatEndState(input: {
  event: Extract<DesktopEvent, { type: 'chat-update' }>
  latestWorkspaceState: DesktopEventSelectionState
  runtime: DesktopEventSyncRuntime
}) {
  if (input.event.reason === 'start') {
    void input.runtime.refreshWorkspaceNavigationState()
    return
  }
  if (!(input.event.reason === 'end' || input.event.reason === 'external')) return
  const { chatEndContribution } = input.runtime.desktopEventStateRef.current
  // Preserve list refresh, core sidebar refresh, then directory cache/Git refresh ordering.
  chatEndContribution?.refreshChatList(input.event, input.latestWorkspaceState.activeView)
  void input.runtime.refreshWorkspaceNavigationState()
  chatEndContribution?.refreshDirectoryState(input.event, input.latestWorkspaceState.activeView)
}

function rememberLocalDraftSessionAlias(input: {
  event: Extract<DesktopEvent, { type: 'chat-update' }>
  flags: ReturnType<typeof getChatEventFlags>
  latestWorkspaceState: DesktopEventSelectionState
  localDraftConversationIdByPersistedConversationIdRef: React.RefObject<Map<string, string>>
}) {
  if (
    input.flags.shouldDisplayLocalDraftChat &&
    input.latestWorkspaceState.selectedConversationId
  ) {
    input.localDraftConversationIdByPersistedConversationIdRef.current.set(
      input.event.conversationId,
      input.latestWorkspaceState.selectedConversationId,
    )
  }
  const replacesConversationId = input.event.replacesConversationId
  if (typeof replacesConversationId === 'string' && isLocalConversationId(replacesConversationId)) {
    input.localDraftConversationIdByPersistedConversationIdRef.current.set(
      input.event.conversationId,
      replacesConversationId,
    )
  }
}

export function handleChatUpdateEvent(
  runtime: DesktopEventSyncRuntime,
  event: Extract<DesktopEvent, { type: 'chat-update' }>,
) {
  const { workspaceState: latestWorkspaceState } = runtime.desktopEventStateRef.current
  const visibleConversationId = getVisibleDesktopConversationId(latestWorkspaceState)
  const chatWithPreferences = mergeChatPreferences({ event, queryClient: runtime.queryClient })
  const flags = getChatEventFlags({ event, latestWorkspaceState, visibleConversationId })
  rememberLocalDraftSessionAlias({
    event,
    flags,
    latestWorkspaceState,
    localDraftConversationIdByPersistedConversationIdRef:
      runtime.localDraftConversationIdByPersistedConversationIdRef,
  })
  const aliasedLocalDraftConversationId =
    runtime.localDraftConversationIdByPersistedConversationIdRef.current.get(
      event.conversationId,
    ) ?? null
  updateLiveChatData({
    aliasedLocalDraftConversationId,
    event,
    flags,
    setLiveChatData: runtime.setLiveChatData,
    chatWithPreferences,
  })
  if (flags.isCompactionChatUpdate && flags.isVisibleChatUpdate)
    runtime.setChatHistoryCompactions(0)
  if (
    event.composer &&
    (event.conversationId === visibleConversationId ||
      aliasedLocalDraftConversationId === latestWorkspaceState.selectedConversationId)
  )
    runtime.setComposerState(event.composer)
  if (
    event.reason === 'start' ||
    event.reason === 'end' ||
    event.reason === 'external' ||
    event.reason === 'compaction'
  ) {
    applyChatEventToSidebarState({
      event,
      workspaceState: latestWorkspaceState,
      queryClient: runtime.queryClient,
      setWorkspaceNavigationState: runtime.setWorkspaceNavigationState,
    })
    void runtime.queryClient.invalidateQueries({ queryKey: desktopQueryKeys.inboxChats() })
  }
  if (
    (event.reason === 'end' || event.reason === 'external') &&
    visibleConversationId === event.conversationId
  ) {
    void refreshVisibleInboxChat({
      event,
      loadDirectoryChats: runtime.loadDirectoryChats,
      queryClient: runtime.queryClient,
    }).catch((error) => console.warn('Failed to keep active inbox chat marked read.', error))
  }
  dispatchChatOpenIfNeeded({ dispatch: runtime.dispatch, event, flags, latestWorkspaceState })
  refreshChatEndState({ event, latestWorkspaceState, runtime })
  void runtime.queryClient.invalidateQueries({
    queryKey: desktopQueryKeys.conversationEntries(event.conversationId),
  })
}
