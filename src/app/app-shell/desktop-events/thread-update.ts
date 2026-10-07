import { isLocalConversationId } from '@howcode/shared/conversation-ids'
import type { Dispatch, SetStateAction } from 'react'
import type { DesktopEvent, ThreadData } from '../../desktop/types'
import { desktopQueryKeys } from '../../query/desktop-query'
import type { WorkspaceAction } from '../../state/workspace'
import {
  type DesktopEventSelectionState,
  getVisibleDesktopConversationId,
  invalidateProjectWorktreeQueries,
  refreshVisibleInboxThread,
  shouldAutoOpenStartedThread,
  shouldDisplayStartedThreadForLocalDraft,
} from '../desktop-event-sync'
import { applyThreadEventToSidebarState } from '../sidebar-thread-sync'
import type { DesktopEventQueryClient, DesktopEventSyncRuntime } from './runtime'

function mergeThreadPreferences(input: {
  event: Extract<DesktopEvent, { type: 'thread-update' }>
  queryClient: DesktopEventQueryClient
}) {
  let threadWithPreferences = input.event.thread
  let hadCachedThread = false
  input.queryClient.setQueryData(
    desktopQueryKeys.thread(input.event.conversationId),
    (current: unknown) => {
      const currentThread = current as ThreadData | null | undefined
      hadCachedThread = Boolean(currentThread)
      threadWithPreferences = {
        ...input.event.thread,
        diffPreferences: input.event.thread.diffPreferences ?? currentThread?.diffPreferences,
      }
      return threadWithPreferences
    },
  )
  if (!(input.event.thread.diffPreferences || hadCachedThread)) {
    void input.queryClient.invalidateQueries({
      queryKey: desktopQueryKeys.threadPrefix(input.event.conversationId),
    })
  }
  return threadWithPreferences
}

function getThreadEventFlags(input: {
  event: Extract<DesktopEvent, { type: 'thread-update' }>
  latestWorkspaceState: DesktopEventSelectionState
  visibleConversationId: string | null
}) {
  const shouldAutoOpenThread = shouldAutoOpenStartedThread({
    reason: input.event.reason,
    projectId: input.event.projectId,
    isChat: input.event.isChat,
    workspaceState: input.latestWorkspaceState,
  })
  const shouldDisplayLocalDraftThread = shouldDisplayStartedThreadForLocalDraft({
    reason: input.event.reason,
    projectId: input.event.projectId,
    isChat: input.event.isChat,
    replacesConversationId: input.event.replacesConversationId,
    workspaceState: input.latestWorkspaceState,
  })
  return {
    hasVisibleAssistantActivity: input.event.thread.messages.some(
      (message) => message.role !== 'user',
    ),
    isCompactionThreadUpdate:
      input.event.reason === 'compaction-start' || input.event.reason === 'compaction',
    isVisibleThreadUpdate: input.event.conversationId === input.visibleConversationId,
    shouldAutoOpenThread,
    shouldDisplayLocalDraftThread,
  }
}

function updateLiveThreadData(input: {
  aliasedLocalDraftConversationId: string | null
  event: Extract<DesktopEvent, { type: 'thread-update' }>
  flags: ReturnType<typeof getThreadEventFlags>
  setLiveThreadData: Dispatch<SetStateAction<ThreadData | null>>
  threadWithPreferences: ThreadData
}) {
  input.setLiveThreadData((current) => {
    const shouldApplyLiveThread =
      input.flags.isVisibleThreadUpdate ||
      input.flags.shouldAutoOpenThread ||
      input.aliasedLocalDraftConversationId === current?.conversationId ||
      current?.conversationId === input.event.conversationId
    if (!shouldApplyLiveThread) return current
    const shouldSuppressFirstTurnTimeline =
      !input.flags.hasVisibleAssistantActivity &&
      (input.aliasedLocalDraftConversationId === current?.conversationId ||
        (input.flags.isVisibleThreadUpdate &&
          current?.isStreaming === true &&
          current.messages.length === 0))
    return {
      ...input.threadWithPreferences,
      messages: shouldSuppressFirstTurnTimeline ? [] : input.threadWithPreferences.messages,
      conversationId:
        input.aliasedLocalDraftConversationId && !input.flags.hasVisibleAssistantActivity
          ? input.aliasedLocalDraftConversationId
          : input.threadWithPreferences.conversationId,
      diffPreferences: input.threadWithPreferences.diffPreferences ?? current?.diffPreferences,
    }
  })
}

function dispatchThreadOpenIfNeeded(input: {
  dispatch: Dispatch<WorkspaceAction>
  event: Extract<DesktopEvent, { type: 'thread-update' }>
  flags: ReturnType<typeof getThreadEventFlags>
  latestWorkspaceState: DesktopEventSelectionState
}) {
  if (
    input.flags.shouldDisplayLocalDraftThread &&
    input.latestWorkspaceState.activeView === 'project'
  ) {
    input.dispatch({
      type: 'start-project-thread',
      projectId: input.event.projectId,
      threadId: input.event.threadId,
      conversationId: input.event.conversationId,
    })
    return
  }

  if (
    input.flags.shouldAutoOpenThread ||
    (input.flags.shouldDisplayLocalDraftThread && input.flags.hasVisibleAssistantActivity)
  ) {
    input.dispatch({
      type: 'open-thread',
      projectId: input.event.projectId,
      threadId: input.event.threadId,
      conversationId: input.event.conversationId,
      view: input.event.isChat === true ? 'chat' : 'thread',
    })
    return
  }
  if (
    input.flags.isVisibleThreadUpdate &&
    input.latestWorkspaceState.selectedThreadId !== input.event.threadId &&
    (input.latestWorkspaceState.activeView === 'chat' ||
      input.latestWorkspaceState.activeView === 'thread')
  ) {
    input.dispatch({
      type: 'open-thread',
      projectId: input.event.projectId,
      threadId: input.event.threadId,
      conversationId: input.event.conversationId,
      view: input.latestWorkspaceState.activeView,
    })
  }
}

function refreshThreadEndState(input: {
  event: Extract<DesktopEvent, { type: 'thread-update' }>
  latestComposerProjectId: string
  latestWorkspaceState: DesktopEventSelectionState
  runtime: DesktopEventSyncRuntime
}) {
  if (!(input.event.reason === 'end' || input.event.reason === 'external')) return
  if (input.event.isChat === true) {
    if (
      input.runtime.desktopEventStateRef.current.codingEnabled !== false &&
      input.latestWorkspaceState.activeView === 'chat'
    )
      void input.runtime.loadProjectThreads(input.event.projectId, { chat: true })
    void input.runtime.refreshChatSidebarState()
  } else if (
    input.runtime.desktopEventStateRef.current.codingEnabled !== false &&
    input.latestWorkspaceState.activeView !== 'chat'
  ) {
    void input.runtime.loadProjectThreads(input.event.projectId)
  }
  invalidateProjectWorktreeQueries({
    activeView: input.latestWorkspaceState.activeView,
    projectId: input.event.projectId,
    queryClient: input.runtime.queryClient,
  })
  void input.runtime.queryClient.invalidateQueries({
    queryKey: desktopQueryKeys.projectUsageSummary(input.event.projectId),
  })
  if (
    input.runtime.desktopEventStateRef.current.codingEnabled !== false &&
    input.event.projectId === input.latestComposerProjectId
  ) {
    void input.runtime
      .loadProjectGitState(input.event.projectId)
      .then(input.runtime.setProjectGitState)
  }
}

function rememberLocalDraftSessionAlias(input: {
  event: Extract<DesktopEvent, { type: 'thread-update' }>
  flags: ReturnType<typeof getThreadEventFlags>
  latestWorkspaceState: DesktopEventSelectionState
  localDraftConversationIdByPersistedConversationIdRef: React.RefObject<Map<string, string>>
}) {
  if (
    input.flags.shouldDisplayLocalDraftThread &&
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

export function handleThreadUpdateEvent(
  runtime: DesktopEventSyncRuntime,
  event: Extract<DesktopEvent, { type: 'thread-update' }>,
) {
  const { composerProjectId: latestComposerProjectId, workspaceState: latestWorkspaceState } =
    runtime.desktopEventStateRef.current
  const visibleConversationId = getVisibleDesktopConversationId(latestWorkspaceState)
  const threadWithPreferences = mergeThreadPreferences({ event, queryClient: runtime.queryClient })
  const flags = getThreadEventFlags({ event, latestWorkspaceState, visibleConversationId })
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
  updateLiveThreadData({
    aliasedLocalDraftConversationId,
    event,
    flags,
    setLiveThreadData: runtime.setLiveThreadData,
    threadWithPreferences,
  })
  if (flags.isCompactionThreadUpdate && flags.isVisibleThreadUpdate)
    runtime.setThreadHistoryCompactions(0)
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
    applyThreadEventToSidebarState({
      event,
      workspaceState: latestWorkspaceState,
      queryClient: runtime.queryClient,
      setChatSidebarState: runtime.setChatSidebarState,
    })
    void runtime.queryClient.invalidateQueries({ queryKey: desktopQueryKeys.inboxThreads() })
  }
  if (
    (event.reason === 'end' || event.reason === 'external') &&
    visibleConversationId === event.conversationId
  ) {
    void refreshVisibleInboxThread({
      event,
      loadProjectThreads: runtime.loadProjectThreads,
      queryClient: runtime.queryClient,
    }).catch((error) => console.warn('Failed to keep active inbox thread marked read.', error))
  }
  dispatchThreadOpenIfNeeded({ dispatch: runtime.dispatch, event, flags, latestWorkspaceState })
  refreshThreadEndState({ event, latestComposerProjectId, latestWorkspaceState, runtime })
  void runtime.queryClient.invalidateQueries({
    queryKey: desktopQueryKeys.conversationEntries(event.conversationId),
  })
}
