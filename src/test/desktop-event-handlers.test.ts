import { describe, expect, it, vi } from 'vitest'
import { createLocalThreadDraft } from '../../shared/session-paths'
import type { DesktopEventSyncRuntime } from '../app/app-shell/desktop-event-handlers'
import { handleDesktopEvent, type QueryClientLike } from '../app/app-shell/desktop-event-handlers'
import type { ComposerState, ShellState, ThreadData } from '../app/desktop/types'
import { desktopQueryKeys } from '../app/query/desktop-query'

function createComposerState(): ComposerState {
  return {
    currentModel: null,
    availableModels: [],
    currentThinkingLevel: 'medium',
    availableThinkingLevels: [],
    queuedPrompts: [],
    nativeAskQuestionsRequest: null,
    contextUsage: null,
    isCompacting: false,
    isExtensionCommandRunning: false,
  }
}

function createThreadData(sessionPath: string): ThreadData {
  return {
    sessionPath,
    title: 'Implement auth flow',
    messages: [{ id: 'user-1', role: 'user', content: ['Build auth flow'] }],
    previousMessageCount: 0,
    isStreaming: true,
    isCompacting: false,
  }
}

function createRuntime(input: {
  localSessionPath: string
  projectId: string
  shellState: ShellState
}) {
  const queryData = new Map<string, unknown>([
    [JSON.stringify(desktopQueryKeys.shellState()), input.shellState],
  ])
  const queryClient: QueryClientLike = {
    setQueryData: (queryKey, updater) => {
      const key = JSON.stringify(queryKey)
      const current = queryData.get(key)
      queryData.set(key, typeof updater === 'function' ? updater(current) : updater)
    },
    invalidateQueries: vi.fn(),
  }

  return {
    runtime: {
      desktopEventStateRef: {
        current: {
          composerProjectId: input.projectId,
          workspaceState: {
            activeView: 'project',
            selectedProjectId: input.projectId,
            selectedThreadId: 'local-thread-draft',
            selectedSessionPath: input.localSessionPath,
            selectedInboxSessionPath: null,
          },
        },
      },
      dispatch: vi.fn(),
      loadProjectThreads: vi.fn(),
      loadProjectGitState: vi.fn(async () => null),
      queryClient,
      refreshChatSidebarState: vi.fn(),
      scheduleShellStateRefresh: vi.fn(),
      setChatSidebarState: vi.fn(),
      setComposerState: vi.fn(),
      setLiveThreadData: vi.fn(),
      setProjectGitState: vi.fn(),
      setThreadHistoryCompactions: vi.fn(),
      localDraftSessionPathByPersistedSessionPathRef: { current: new Map<string, string>() },
    } satisfies DesktopEventSyncRuntime,
    getQueryData: (queryKey: readonly unknown[]) => queryData.get(JSON.stringify(queryKey)),
  }
}

describe('desktop event handlers', () => {
  it.each([
    { reason: 'start' as const, replacesSessionPath: undefined },
    { reason: 'external' as const, replacesSessionPath: 'draft' },
  ])('reassigns project-dashboard local drafts to the persisted thread on $reason updates', ({
    reason,
    replacesSessionPath,
  }) => {
    const projectId = '/repo/project-a'
    const localDraft = createLocalThreadDraft(projectId, 'draft')
    const persistedSessionPath = '/sessions/project-a/thread.jsonl'
    const composer = createComposerState()
    const shellState = {
      projects: [
        {
          id: projectId,
          name: 'project-a',
          threadsLoaded: true,
          threadCount: 1,
          collapsed: false,
          threads: [
            {
              id: localDraft.threadId,
              title: 'New thread',
              age: 'Now',
              sessionPath: localDraft.sessionPath,
            },
          ],
        },
      ],
    } as ShellState
    const { runtime, getQueryData } = createRuntime({
      localSessionPath: localDraft.sessionPath,
      projectId,
      shellState,
    })

    handleDesktopEvent(runtime, {
      type: 'thread-update',
      reason,
      projectId,
      threadId: 'persisted-thread-1',
      sessionPath: persistedSessionPath,
      isChat: false,
      chatGroupId: null,
      thread: createThreadData(persistedSessionPath),
      replacesSessionPath: replacesSessionPath === 'draft' ? localDraft.sessionPath : undefined,
      composer,
    })

    expect(runtime.dispatch).toHaveBeenCalledWith({
      type: 'start-project-thread',
      projectId,
      threadId: 'persisted-thread-1',
      sessionPath: persistedSessionPath,
    })
    expect(runtime.setComposerState).toHaveBeenCalledWith(composer)
    const nextShellState = getQueryData(desktopQueryKeys.shellState()) as ShellState
    expect(nextShellState.projects[0]?.threads).toMatchObject([
      {
        id: 'persisted-thread-1',
        title: 'Implement auth flow',
        sessionPath: persistedSessionPath,
      },
    ])
  })
})
