import type { Dispatch, SetStateAction } from 'react'
import { useEffect, useRef } from 'react'
import type {
  ChatSidebarState,
  ComposerState,
  DesktopEvent,
  ProjectGitState,
  ThreadData,
} from '../desktop/types'
import { desktopQueryKeys } from '../query/desktop-query'
import type { WorkspaceAction, WorkspaceState } from '../state/workspace'
import {
  type DesktopEventSelectionState,
  getVisibleDesktopSessionPath,
  invalidateProjectWorktreeQueries,
  refreshVisibleInboxThread,
  shouldAutoOpenStartedThread,
  shouldDisplayStartedThreadForLocalDraft,
} from './desktop-event-sync'
import { applyThreadEventToSidebarState } from './sidebar-thread-sync'

type QueryClientLike = {
  setQueryData: (queryKey: readonly unknown[], updater: unknown) => void
  invalidateQueries: (filters: { queryKey: readonly unknown[] }) => Promise<unknown> | unknown
}

type UseDesktopEventSyncInput = {
  composerProjectId: string
  workspaceState: WorkspaceState
  loadProjectThreads: (
    projectId: string,
    options?: { chat?: boolean | undefined },
  ) => Promise<unknown>
  loadProjectGitState: (projectId: string) => Promise<ProjectGitState | null>
  scheduleShellStateRefresh: () => void
  refreshChatSidebarState: () => Promise<unknown>
  queryClient: QueryClientLike
  dispatch: Dispatch<WorkspaceAction>
  setComposerState: Dispatch<SetStateAction<ComposerState | null>>
  setChatSidebarState: Dispatch<SetStateAction<ChatSidebarState | null>>
  setLiveThreadData: Dispatch<SetStateAction<ThreadData | null>>
  setProjectGitState: Dispatch<SetStateAction<ProjectGitState | null>>
  setThreadHistoryCompactions: Dispatch<SetStateAction<number>>
}

type DesktopEventSyncRuntime = Omit<
  UseDesktopEventSyncInput,
  'composerProjectId' | 'workspaceState'
> & {
  desktopEventStateRef: React.RefObject<{
    composerProjectId: string
    workspaceState: DesktopEventSelectionState
  }>
  localDraftSessionPathByPersistedSessionPathRef: React.RefObject<Map<string, string>>
}

function shouldApplyComposerUpdate(input: {
  event: Extract<DesktopEvent, { type: 'composer-update' }>
  latestComposerProjectId: string
  latestWorkspaceState: DesktopEventSelectionState
  localDraftSessionPathByPersistedSessionPathRef: React.RefObject<Map<string, string>>
  visibleSessionPath: string | null
}) {
  const aliasedLocalDraftSessionPath = input.event.sessionPath
    ? input.localDraftSessionPathByPersistedSessionPathRef.current.get(input.event.sessionPath)
    : null
  if (input.event.sessionPath) {
    return (
      input.event.sessionPath === input.visibleSessionPath ||
      aliasedLocalDraftSessionPath === input.latestWorkspaceState.selectedSessionPath
    )
  }
  return (
    input.event.projectId === input.latestComposerProjectId &&
    ((input.latestWorkspaceState.activeView !== 'thread' &&
      input.latestWorkspaceState.activeView !== 'gitops' &&
      input.latestWorkspaceState.activeView !== 'chat') ||
      input.visibleSessionPath === null)
  )
}

function handleComposerUpdateEvent(
  runtime: DesktopEventSyncRuntime,
  event: Extract<DesktopEvent, { type: 'composer-update' }>,
) {
  const { composerProjectId: latestComposerProjectId, workspaceState: latestWorkspaceState } =
    runtime.desktopEventStateRef.current
  const visibleSessionPath = getVisibleDesktopSessionPath(latestWorkspaceState)
  if (
    shouldApplyComposerUpdate({
      event,
      latestComposerProjectId,
      latestWorkspaceState,
      localDraftSessionPathByPersistedSessionPathRef:
        runtime.localDraftSessionPathByPersistedSessionPathRef,
      visibleSessionPath,
    })
  )
    runtime.setComposerState(event.composer)
}

function mergeThreadPreferences(input: {
  event: Extract<DesktopEvent, { type: 'thread-update' }>
  queryClient: QueryClientLike
}) {
  let threadWithPreferences = input.event.thread
  let hadCachedThread = false
  input.queryClient.setQueryData(
    desktopQueryKeys.thread(input.event.sessionPath),
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
      queryKey: desktopQueryKeys.threadPrefix(input.event.sessionPath),
    })
  }
  return threadWithPreferences
}

function getThreadEventFlags(input: {
  event: Extract<DesktopEvent, { type: 'thread-update' }>
  latestWorkspaceState: DesktopEventSelectionState
  visibleSessionPath: string | null
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
    workspaceState: input.latestWorkspaceState,
  })
  return {
    hasVisibleAssistantActivity: input.event.thread.messages.some(
      (message) => message.role !== 'user',
    ),
    isCompactionThreadUpdate:
      input.event.reason === 'compaction-start' || input.event.reason === 'compaction',
    isVisibleThreadUpdate: input.event.sessionPath === input.visibleSessionPath,
    shouldAutoOpenThread,
    shouldDisplayLocalDraftThread,
  }
}

function updateLiveThreadData(input: {
  aliasedLocalDraftSessionPath: string | null
  event: Extract<DesktopEvent, { type: 'thread-update' }>
  flags: ReturnType<typeof getThreadEventFlags>
  setLiveThreadData: Dispatch<SetStateAction<ThreadData | null>>
  threadWithPreferences: ThreadData
}) {
  input.setLiveThreadData((current) => {
    const shouldApplyLiveThread =
      input.flags.isVisibleThreadUpdate ||
      input.flags.shouldAutoOpenThread ||
      input.aliasedLocalDraftSessionPath === current?.sessionPath ||
      current?.sessionPath === input.event.sessionPath
    if (!shouldApplyLiveThread) return current
    const shouldSuppressFirstTurnTimeline =
      !input.flags.hasVisibleAssistantActivity &&
      (input.aliasedLocalDraftSessionPath === current?.sessionPath ||
        (input.flags.isVisibleThreadUpdate &&
          current?.isStreaming === true &&
          current.messages.length === 0))
    return {
      ...input.threadWithPreferences,
      messages: shouldSuppressFirstTurnTimeline ? [] : input.threadWithPreferences.messages,
      sessionPath:
        input.aliasedLocalDraftSessionPath && !input.flags.hasVisibleAssistantActivity
          ? input.aliasedLocalDraftSessionPath
          : input.threadWithPreferences.sessionPath,
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
    input.flags.shouldAutoOpenThread ||
    (input.flags.shouldDisplayLocalDraftThread && input.flags.hasVisibleAssistantActivity)
  ) {
    input.dispatch({
      type: 'open-thread',
      projectId: input.event.projectId,
      threadId: input.event.threadId,
      sessionPath: input.event.sessionPath,
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
      sessionPath: input.event.sessionPath,
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
    if (input.latestWorkspaceState.activeView === 'chat')
      void input.runtime.loadProjectThreads(input.event.projectId, { chat: true })
    void input.runtime.refreshChatSidebarState()
  } else if (input.latestWorkspaceState.activeView !== 'chat') {
    void input.runtime.loadProjectThreads(input.event.projectId)
  }
  invalidateProjectWorktreeQueries({
    activeView: input.latestWorkspaceState.activeView,
    projectId: input.event.projectId,
    queryClient: input.runtime.queryClient,
  })
  if (input.event.projectId === input.latestComposerProjectId) {
    void input.runtime
      .loadProjectGitState(input.event.projectId)
      .then(input.runtime.setProjectGitState)
  }
}

function handleThreadUpdateEvent(
  runtime: DesktopEventSyncRuntime,
  event: Extract<DesktopEvent, { type: 'thread-update' }>,
) {
  const { composerProjectId: latestComposerProjectId, workspaceState: latestWorkspaceState } =
    runtime.desktopEventStateRef.current
  const visibleSessionPath = getVisibleDesktopSessionPath(latestWorkspaceState)
  const threadWithPreferences = mergeThreadPreferences({ event, queryClient: runtime.queryClient })
  const flags = getThreadEventFlags({ event, latestWorkspaceState, visibleSessionPath })
  if (flags.shouldDisplayLocalDraftThread && latestWorkspaceState.selectedSessionPath) {
    runtime.localDraftSessionPathByPersistedSessionPathRef.current.set(
      event.sessionPath,
      latestWorkspaceState.selectedSessionPath,
    )
  }
  const aliasedLocalDraftSessionPath =
    runtime.localDraftSessionPathByPersistedSessionPathRef.current.get(event.sessionPath) ?? null
  updateLiveThreadData({
    aliasedLocalDraftSessionPath,
    event,
    flags,
    setLiveThreadData: runtime.setLiveThreadData,
    threadWithPreferences,
  })
  if (flags.isCompactionThreadUpdate && flags.isVisibleThreadUpdate)
    runtime.setThreadHistoryCompactions(0)
  if (event.composer && event.sessionPath === visibleSessionPath)
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
    if (event.reason !== 'compaction') runtime.scheduleShellStateRefresh()
  }
  if (
    (event.reason === 'end' || event.reason === 'external') &&
    visibleSessionPath === event.sessionPath
  ) {
    void refreshVisibleInboxThread({
      event,
      loadProjectThreads: runtime.loadProjectThreads,
      queryClient: runtime.queryClient,
    }).catch((error) => console.warn('Failed to keep active inbox thread marked read.', error))
  }
  dispatchThreadOpenIfNeeded({ dispatch: runtime.dispatch, event, flags, latestWorkspaceState })
  refreshThreadEndState({ event, latestComposerProjectId, latestWorkspaceState, runtime })
}

function handleDesktopEvent(runtime: DesktopEventSyncRuntime, event: DesktopEvent) {
  if (event.type === 'shell-state-refresh') {
    runtime.scheduleShellStateRefresh()
    return
  }
  if (event.type === 'composer-update') {
    handleComposerUpdateEvent(runtime, event)
    return
  }
  if (event.type === 'thread-update') handleThreadUpdateEvent(runtime, event)
}

export function useDesktopEventSync({
  composerProjectId,
  workspaceState,
  loadProjectThreads,
  loadProjectGitState,
  scheduleShellStateRefresh,
  refreshChatSidebarState,
  queryClient,
  dispatch,
  setComposerState,
  setChatSidebarState,
  setLiveThreadData,
  setProjectGitState,
  setThreadHistoryCompactions,
}: UseDesktopEventSyncInput) {
  const desktopEventStateRef = useRef({
    composerProjectId,
    workspaceState: {
      activeView: workspaceState.activeView,
      selectedProjectId: workspaceState.selectedProjectId,
      selectedThreadId: workspaceState.selectedThreadId,
      selectedSessionPath: workspaceState.selectedSessionPath,
      selectedInboxSessionPath: workspaceState.selectedInboxSessionPath,
    } satisfies DesktopEventSelectionState,
  })
  const localDraftSessionPathByPersistedSessionPathRef = useRef(new Map<string, string>())

  useEffect(() => {
    desktopEventStateRef.current = {
      composerProjectId,
      workspaceState: {
        activeView: workspaceState.activeView,
        selectedProjectId: workspaceState.selectedProjectId,
        selectedThreadId: workspaceState.selectedThreadId,
        selectedSessionPath: workspaceState.selectedSessionPath,
        selectedInboxSessionPath: workspaceState.selectedInboxSessionPath,
      },
    }
  }, [
    composerProjectId,
    workspaceState.activeView,
    workspaceState.selectedProjectId,
    workspaceState.selectedThreadId,
    workspaceState.selectedInboxSessionPath,
    workspaceState.selectedSessionPath,
  ])

  useEffect(() => {
    if (!window.piDesktop?.subscribe) {
      return
    }

    // Keep the subscription stable. Re-subscribing on every selection change can drop in-flight
    // thread updates when a GUI-started thread flips from local draft to persisted session path.
    const runtime: DesktopEventSyncRuntime = {
      dispatch,
      loadProjectGitState,
      loadProjectThreads,
      queryClient,
      refreshChatSidebarState,
      scheduleShellStateRefresh,
      setChatSidebarState,
      setComposerState,
      setLiveThreadData,
      setProjectGitState,
      setThreadHistoryCompactions,
      desktopEventStateRef,
      localDraftSessionPathByPersistedSessionPathRef,
    }
    const unsubscribe = window.piDesktop.subscribe((event: DesktopEvent) =>
      handleDesktopEvent(runtime, event),
    )

    return unsubscribe
  }, [
    dispatch,
    loadProjectGitState,
    loadProjectThreads,
    queryClient,
    refreshChatSidebarState,
    scheduleShellStateRefresh,
    setChatSidebarState,
    setComposerState,
    setLiveThreadData,
    setProjectGitState,
    setThreadHistoryCompactions,
  ])
}
