import { getLocalDraftBranchName, isLocalConversationId } from '@howcode/shared/conversation-ids'
import type {
  ChatSidebarState,
  DesktopActionResult,
  DesktopEvent,
  Thread,
  ThreadData,
} from '../desktop/types'
import { forgetLocalDraftThread } from '../hooks/useDesktopProjectThreads'
import type { WorkspaceAction, WorkspaceState } from '../state/workspace'
import {
  applyChatThreadToSidebarState,
  removeChatThreadFromSidebarState,
} from './chat-sidebar-cache'
import type { ActionPayload } from './controller-action-utils'
import { getPayloadProjectId, hasActionError } from './controller-action-utils'
import {
  applyProjectThreadToShellState,
  getDraftReplacementConversationId,
  removeProjectThreadFromShellState,
} from './project-thread-cache'
import {
  buildLocalThreadFallback,
  buildOptimisticThread,
  getInitialThreadBranchName,
} from './thread-drafts'

type QueryClientLike = Parameters<typeof applyProjectThreadToShellState>[0] & {
  getQueryData?: (queryKey: readonly unknown[]) => unknown
}

type DispatchWorkspaceAction = (action: WorkspaceAction) => void

type SetChatSidebarState = (
  updater: (state: ChatSidebarState | null) => ChatSidebarState | null,
) => void

type SetLiveThreadData = (updater: (state: ThreadData | null) => ThreadData | null) => void

type OptimisticComposerThreadResult = {
  contextualPayload: ActionPayload
}

function getContextualChatGroupId(payload: ActionPayload) {
  return typeof payload.chatGroupId === 'string' ? payload.chatGroupId : null
}

function upsertSidebarThread({
  queryClient,
  setChatSidebarState,
  projectId,
  thread,
  chatGroupId,
  updateProjectThreads = true,
  replaceConversationId = null,
  revealProject = false,
}: {
  queryClient: QueryClientLike
  setChatSidebarState: SetChatSidebarState
  projectId: string
  thread: Thread
  chatGroupId?: string | null | undefined
  updateProjectThreads?: boolean | undefined
  replaceConversationId?: string | null | undefined
  revealProject?: boolean | undefined
}) {
  if (updateProjectThreads) {
    applyProjectThreadToShellState(queryClient, projectId, thread, {
      replaceConversationId,
      revealProject,
    })
  }

  if (chatGroupId !== undefined) {
    setChatSidebarState((current) =>
      applyChatThreadToSidebarState(
        current,
        {
          ...thread,
          projectId,
          groupId: chatGroupId,
        },
        { replaceConversationId },
      ),
    )
  }
}

function getCachedThreadTitle(
  queryClient: QueryClientLike,
  projectId: string,
  threadId: string,
  conversationId: string,
) {
  const shellState = queryClient.getQueryData?.(['desktop', 'shellState']) as
    | {
        projects?: Array<{
          id: string
          threads: Array<{
            id: string
            conversationId?: string | null
            title?: string
          }>
        }>
      }
    | null
    | undefined

  return (
    shellState?.projects
      ?.find((candidate) => candidate.id === projectId)
      ?.threads.find(
        (candidate) => candidate.id === threadId || candidate.conversationId === conversationId,
      )?.title ?? null
  )
}

export function applyOptimisticComposerThread({
  activeView,
  contextualPayload,
  queryClient,
  dispatch,
  setChatSidebarState,
  setLiveThreadData,
}: {
  activeView: WorkspaceState['activeView']
  contextualPayload: ActionPayload
  queryClient: QueryClientLike
  dispatch: DispatchWorkspaceAction
  setChatSidebarState: SetChatSidebarState
  setLiveThreadData: SetLiveThreadData
}): OptimisticComposerThreadResult {
  if (
    activeView === 'inbox' ||
    typeof contextualPayload.projectId !== 'string' ||
    contextualPayload.conversationId
  ) {
    return { contextualPayload }
  }

  const chatGroupId = activeView === 'chat' ? getContextualChatGroupId(contextualPayload) : null
  const branchName = getInitialThreadBranchName(contextualPayload.branchName)
  const localFallback = buildLocalThreadFallback(contextualPayload.projectId, {
    chatGroupId,
    branchName,
  })
  const nextPayload = { ...contextualPayload, conversationId: localFallback.conversationId }
  const thread = buildOptimisticThread({
    id: localFallback.threadId,
    conversationId: localFallback.conversationId,
    branchName: getLocalDraftBranchName(localFallback.conversationId),
    running: true,
  })

  upsertSidebarThread({
    queryClient,
    setChatSidebarState,
    projectId: localFallback.projectId,
    thread,
    chatGroupId: activeView === 'chat' ? chatGroupId : undefined,
    revealProject: true,
  })
  setLiveThreadData(() => ({
    conversationId: localFallback.conversationId,
    title: 'New thread',
    messages: [],
    previousMessageCount: 0,
    isStreaming: true,
    isCompacting: false,
  }))
  dispatch({
    type: 'open-thread',
    projectId: localFallback.projectId,
    threadId: localFallback.threadId,
    conversationId: localFallback.conversationId,
    view: activeView === 'chat' ? 'chat' : 'thread',
  })

  return { contextualPayload: nextPayload }
}

export function removeFailedOptimisticComposerThread({
  contextualPayload,
  queryClient,
  setChatSidebarState,
  setLiveThreadData,
}: {
  contextualPayload: ActionPayload
  queryClient: QueryClientLike
  setChatSidebarState: SetChatSidebarState
  setLiveThreadData?: SetLiveThreadData
}) {
  const projectId = getPayloadProjectId(contextualPayload)
  const conversationId =
    typeof contextualPayload.conversationId === 'string' ? contextualPayload.conversationId : null

  if (!(projectId && conversationId && isLocalConversationId(conversationId))) return

  removeProjectThreadFromShellState(queryClient, projectId, conversationId)
  setChatSidebarState((current) => removeChatThreadFromSidebarState(current, conversationId))
  setLiveThreadData?.((current) => (current?.conversationId === conversationId ? null : current))
}

export function reconcileComposerThreadResult({
  contextualPayload,
  actionResult,
  workspaceState,
  queryClient,
  dispatch,
  setChatSidebarState,
  setLiveThreadData,
}: {
  contextualPayload: ActionPayload
  actionResult: DesktopActionResult | null
  workspaceState: WorkspaceState
  queryClient: QueryClientLike
  dispatch: DispatchWorkspaceAction
  setChatSidebarState: SetChatSidebarState
  setLiveThreadData: SetLiveThreadData
}) {
  if (hasActionError(actionResult)) {
    removeFailedOptimisticComposerThread({
      contextualPayload,
      queryClient,
      setChatSidebarState,
      setLiveThreadData,
    })
    return
  }

  const projectId = getPayloadProjectId(contextualPayload)
  const submittedConversationId =
    typeof contextualPayload.conversationId === 'string' ? contextualPayload.conversationId : null
  const resultConversationId =
    typeof actionResult?.result?.composerSendConversationId === 'string'
      ? actionResult.result.composerSendConversationId
      : null
  const resultThreadId =
    typeof actionResult?.result?.composerSendThreadId === 'string'
      ? actionResult.result.composerSendThreadId
      : null
  const sendOutcome = actionResult?.result?.composerSendOutcome

  if (
    !(projectId && resultConversationId && resultThreadId) ||
    (submittedConversationId && !isLocalConversationId(submittedConversationId))
  ) {
    if (sendOutcome === 'stopped') {
      removeFailedOptimisticComposerThread({
        contextualPayload,
        queryClient,
        setChatSidebarState,
        setLiveThreadData,
      })
    }
    return
  }

  const title = getCachedThreadTitle(queryClient, projectId, resultThreadId, resultConversationId)
  const replaceConversationId = isLocalConversationId(submittedConversationId)
    ? submittedConversationId
    : null
  if (replaceConversationId) forgetLocalDraftThread(projectId, replaceConversationId)
  upsertSidebarThread({
    queryClient,
    setChatSidebarState,
    projectId,
    thread: buildOptimisticThread({
      id: resultThreadId,
      title: title ?? 'New thread',
      conversationId: resultConversationId,
      branchName: getLocalDraftBranchName(submittedConversationId),
    }),
    chatGroupId:
      workspaceState.activeView === 'chat'
        ? getContextualChatGroupId(contextualPayload)
        : undefined,
    replaceConversationId,
    revealProject: true,
  })
  setLiveThreadData((current) =>
    current?.conversationId === submittedConversationId
      ? {
          ...current,
          conversationId: resultConversationId,
          title: title ?? current.title,
        }
      : current,
  )
  dispatch({
    type: 'open-thread',
    projectId,
    threadId: resultThreadId,
    conversationId: resultConversationId,
    view: workspaceState.activeView === 'chat' ? 'chat' : 'thread',
  })
}

export function applyThreadEventToSidebarState({
  event,
  workspaceState,
  queryClient,
  setChatSidebarState,
}: {
  event: Extract<DesktopEvent, { type: 'thread-update' }>
  workspaceState: Pick<
    WorkspaceState,
    'activeView' | 'selectedProjectId' | 'selectedConversationId'
  >
  queryClient: QueryClientLike
  setChatSidebarState: SetChatSidebarState
}) {
  const eventIsChat = event.isChat === true
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
          workspaceState.selectedProjectId,
          event.projectId,
        )
      : null)
  const projectThreadScopeMatchesView =
    workspaceState.activeView !== 'inbox' && eventIsChat === (workspaceState.activeView === 'chat')
  if (replaceConversationId) forgetLocalDraftThread(event.projectId, replaceConversationId)
  upsertSidebarThread({
    queryClient,
    setChatSidebarState,
    projectId: event.projectId,
    thread: buildOptimisticThread({
      id: event.threadId,
      title: event.thread.title,
      conversationId: event.conversationId,
      branchName: event.branchName,
      running: event.thread.isStreaming || event.thread.isCompacting,
    }),
    chatGroupId: event.isChat === true ? event.chatGroupId : undefined,
    updateProjectThreads: projectThreadScopeMatchesView,
    replaceConversationId,
  })
}
