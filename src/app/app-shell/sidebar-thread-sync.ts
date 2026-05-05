import { isLocalSessionPath } from '../../../shared/session-paths'
import type {
  ChatSidebarState,
  DesktopActionResult,
  DesktopEvent,
  Thread,
  ThreadData,
} from '../desktop/types'
import type { WorkspaceAction, WorkspaceState } from '../state/workspace'
import {
  applyChatThreadToSidebarState,
  removeChatThreadFromSidebarState,
} from './chat-sidebar-cache'
import type { ActionPayload } from './controller-action-utils'
import {
  buildLocalThreadFallback,
  getPayloadProjectId,
  hasActionError,
} from './controller-action-utils'
import {
  applyProjectThreadToShellState,
  getDraftReplacementSessionPath,
  removeProjectThreadFromShellState,
} from './project-thread-cache'

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

function buildSidebarThread(input: {
  id: string
  title: string
  sessionPath: string
  running?: boolean
  lastModifiedMs?: number
}): Thread {
  return {
    id: input.id,
    title: input.title,
    age: 'Now',
    lastModifiedMs: input.lastModifiedMs ?? Date.now(),
    sessionPath: input.sessionPath,
    running: input.running,
  }
}

function upsertSidebarThread({
  queryClient,
  setChatSidebarState,
  projectId,
  thread,
  chatGroupId,
  updateProjectThreads = true,
  replaceSessionPath = null,
  revealProject = false,
}: {
  queryClient: QueryClientLike
  setChatSidebarState: SetChatSidebarState
  projectId: string
  thread: Thread
  chatGroupId?: string | null | undefined
  updateProjectThreads?: boolean | undefined
  replaceSessionPath?: string | null | undefined
  revealProject?: boolean | undefined
}) {
  if (updateProjectThreads) {
    applyProjectThreadToShellState(queryClient, projectId, thread, {
      replaceSessionPath,
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
        { replaceSessionPath },
      ),
    )
  }
}

function getCachedThreadTitle(
  queryClient: QueryClientLike,
  projectId: string,
  threadId: string,
  sessionPath: string,
) {
  const shellState = queryClient.getQueryData?.(['desktop', 'shellState']) as
    | {
        projects?: Array<{
          id: string
          threads: Array<{
            id: string
            sessionPath?: string | null
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
        (candidate) => candidate.id === threadId || candidate.sessionPath === sessionPath,
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
    contextualPayload.sessionPath
  ) {
    return { contextualPayload }
  }

  const chatGroupId = activeView === 'chat' ? getContextualChatGroupId(contextualPayload) : null
  const localFallback = buildLocalThreadFallback(contextualPayload.projectId, { chatGroupId })
  const nextPayload = { ...contextualPayload, sessionPath: localFallback.sessionPath }
  const thread = buildSidebarThread({
    id: localFallback.threadId,
    title: 'New thread',
    sessionPath: localFallback.sessionPath,
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
    sessionPath: localFallback.sessionPath,
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
    sessionPath: localFallback.sessionPath,
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
  const sessionPath =
    typeof contextualPayload.sessionPath === 'string' ? contextualPayload.sessionPath : null

  if (!(projectId && sessionPath && isLocalSessionPath(sessionPath))) return

  removeProjectThreadFromShellState(queryClient, projectId, sessionPath)
  setChatSidebarState((current) => removeChatThreadFromSidebarState(current, sessionPath))
  setLiveThreadData?.((current) => (current?.sessionPath === sessionPath ? null : current))
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
  const submittedSessionPath =
    typeof contextualPayload.sessionPath === 'string' ? contextualPayload.sessionPath : null
  const resultSessionPath =
    typeof actionResult?.result?.composerSendSessionPath === 'string'
      ? actionResult.result.composerSendSessionPath
      : null
  const resultThreadId =
    typeof actionResult?.result?.composerSendThreadId === 'string'
      ? actionResult.result.composerSendThreadId
      : null
  const sendOutcome = actionResult?.result?.composerSendOutcome

  if (
    !(projectId && resultSessionPath && resultThreadId) ||
    (submittedSessionPath && !isLocalSessionPath(submittedSessionPath))
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

  const title = getCachedThreadTitle(queryClient, projectId, resultThreadId, resultSessionPath)
  const replaceSessionPath = isLocalSessionPath(submittedSessionPath) ? submittedSessionPath : null
  upsertSidebarThread({
    queryClient,
    setChatSidebarState,
    projectId,
    thread: buildSidebarThread({
      id: resultThreadId,
      title: title ?? 'New thread',
      sessionPath: resultSessionPath,
    }),
    chatGroupId:
      workspaceState.activeView === 'chat'
        ? getContextualChatGroupId(contextualPayload)
        : undefined,
    replaceSessionPath,
    revealProject: true,
  })
  setLiveThreadData((current) =>
    current?.sessionPath === submittedSessionPath
      ? {
          ...current,
          sessionPath: resultSessionPath,
          title: title ?? current.title,
        }
      : current,
  )
  dispatch({
    type: 'open-thread',
    projectId,
    threadId: resultThreadId,
    sessionPath: resultSessionPath,
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
  workspaceState: Pick<WorkspaceState, 'activeView' | 'selectedProjectId' | 'selectedSessionPath'>
  queryClient: QueryClientLike
  setChatSidebarState: SetChatSidebarState
}) {
  const replaceSessionPath = getDraftReplacementSessionPath(
    workspaceState.selectedSessionPath,
    workspaceState.selectedProjectId,
    event.projectId,
  )
  const eventIsChat = event.isChat === true
  const projectThreadScopeMatchesView = eventIsChat === (workspaceState.activeView === 'chat')
  upsertSidebarThread({
    queryClient,
    setChatSidebarState,
    projectId: event.projectId,
    thread: buildSidebarThread({
      id: event.threadId,
      title: event.thread.title,
      sessionPath: event.sessionPath,
      running: event.thread.isStreaming || event.thread.isCompacting,
    }),
    chatGroupId: event.isChat === true ? event.chatGroupId : undefined,
    updateProjectThreads: projectThreadScopeMatchesView,
    replaceSessionPath,
  })
}
