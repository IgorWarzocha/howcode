import { describe, expect, it, vi } from 'vitest'
import { applyNewThreadPostEffect } from '../app/app-shell/post-effects/new-thread'
import type { DesktopActionResult } from '../app/desktop/types'
import type { WorkspaceState } from '../app/state/workspace'

function createWorkspaceState(overrides: Partial<WorkspaceState> = {}): WorkspaceState {
  return {
    activeView: 'thread',
    selectedProjectId: '/repo/project-a',
    hasSelectedProject: true,
    landingVisible: false,
    selectedInboxSessionPath: null,
    selectedThreadId: 'thread-1',
    selectedSessionPath: '/sessions/thread-1.jsonl',
    terminalVisible: false,
    workspaceTerminalVisibleByWorkspace: {},
    terminalVisibleBySession: {},
    restoreTerminalVisibleOnGitOpsClose: false,
    takeoverVisible: false,
    takeoverOverrides: {},
    gitOpsReturnView: 'thread',
    selectedDiffFilePath: null,
    utilityViewReturnState: null,
    settingsOpen: false,
    settingsPanelOpen: false,
    collapsedProjectIds: {},
    ...overrides,
  }
}

function createThreadNewResult(): DesktopActionResult {
  return {
    ok: true,
    at: new Date(0).toISOString(),
    payload: { action: 'thread.new', payload: {} },
    result: {
      projectId: '/repo/project-a',
      sessionPath: 'local://%2Frepo%2Fproject-a/draft-1',
      threadId: 'draft-1',
      composer: {
        currentModel: null,
        availableModels: [],
        currentThinkingLevel: 'medium',
        availableThinkingLevels: [],
        queuedPrompts: [],
        nativeAskQuestionsRequest: null,
        nativeExtensionWidgets: [],
        contextUsage: null,
        isCompacting: false,
        isExtensionCommandRunning: false,
      },
    },
  }
}

function createProjectAddResult(): DesktopActionResult {
  return {
    ...createThreadNewResult(),
    payload: { action: 'project.add', payload: {} },
  }
}

describe('new thread post effect', () => {
  it('opens code new-thread actions into a clean thread composer instead of the dashboard', async () => {
    const dispatch = vi.fn()
    const loadProjectThreads = vi.fn()
    const loadComposerState = vi.fn()
    const setComposerState = vi.fn()
    const setQueryData = vi.fn()

    await applyNewThreadPostEffect({
      action: 'thread.new',
      contextualPayload: { projectId: '/repo/project-a', composerMode: 'code' },
      actionResult: createThreadNewResult(),
      workspaceState: createWorkspaceState(),
      composerProjectId: '/repo/project-a',
      queryClient: { setQueryData } as never,
      dispatch,
      refreshShellState: vi.fn(),
      loadProjectThreads,
      loadComposerState,
      setComposerState,
    })

    expect(dispatch).toHaveBeenCalledWith({
      type: 'open-thread',
      projectId: '/repo/project-a',
      threadId: 'draft-1',
      sessionPath: 'local://%2Frepo%2Fproject-a/draft-1',
    })
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'start-project-thread',
        sessionPath: 'local://%2Frepo%2Fproject-a/draft-1',
      }),
    )
    expect(setQueryData).toHaveBeenCalled()
    expect(loadProjectThreads).toHaveBeenCalledWith('/repo/project-a', { chat: false })
    expect(loadComposerState).not.toHaveBeenCalled()
    expect(setComposerState).toHaveBeenCalledWith(createThreadNewResult().result?.composer)
  })

  it('still opens chat drafts immediately', async () => {
    const dispatch = vi.fn()
    const setQueryData = vi.fn()

    await applyNewThreadPostEffect({
      action: 'thread.new',
      contextualPayload: { projectId: '/repo/project-a', composerMode: 'chat' },
      actionResult: createThreadNewResult(),
      workspaceState: createWorkspaceState({ activeView: 'chat' }),
      composerProjectId: '/repo/project-a',
      queryClient: { setQueryData } as never,
      dispatch,
      refreshShellState: vi.fn(),
      loadProjectThreads: vi.fn(),
      loadComposerState: vi.fn(),
      setComposerState: vi.fn(),
    })

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'open-thread',
        sessionPath: 'local://%2Frepo%2Fproject-a/draft-1',
      }),
    )
    expect(setQueryData).toHaveBeenCalled()
  })

  it('loads code composer defaults after adding a project from chat', async () => {
    const dispatch = vi.fn()
    const loadComposerState = vi.fn(async () => createThreadNewResult().result?.composer ?? null)

    await applyNewThreadPostEffect({
      action: 'project.add',
      contextualPayload: { projectId: '/repo/project-a' },
      actionResult: createProjectAddResult(),
      workspaceState: createWorkspaceState({ activeView: 'chat' }),
      composerProjectId: '/repo/project-a',
      queryClient: { setQueryData: vi.fn() } as never,
      dispatch,
      refreshShellState: vi.fn(),
      loadProjectThreads: vi.fn(),
      loadComposerState,
      setComposerState: vi.fn(),
    })

    expect(dispatch).toHaveBeenCalledWith({
      type: 'start-project-thread',
      projectId: '/repo/project-a',
      threadId: 'draft-1',
      sessionPath: 'local://%2Frepo%2Fproject-a/draft-1',
    })
    expect(loadComposerState).toHaveBeenCalledWith({
      projectId: '/repo/project-a',
      composerMode: 'code',
    })
  })

  it('opens a new clean composer even if the dashboard had an old selected draft', async () => {
    const dispatch = vi.fn()
    const setQueryData = vi.fn()

    await applyNewThreadPostEffect({
      action: 'thread.new',
      contextualPayload: { projectId: '/repo/project-a', composerMode: 'code' },
      actionResult: createThreadNewResult(),
      workspaceState: createWorkspaceState({
        activeView: 'project',
        selectedSessionPath: 'local://%2Frepo%2Fproject-a/existing-draft',
        selectedThreadId: 'existing-draft',
      }),
      composerProjectId: '/repo/project-a',
      queryClient: { setQueryData } as never,
      dispatch,
      refreshShellState: vi.fn(),
      loadProjectThreads: vi.fn(),
      loadComposerState: vi.fn(),
      setComposerState: vi.fn(),
    })

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'open-thread',
        sessionPath: 'local://%2Frepo%2Fproject-a/draft-1',
      }),
    )
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'start-project-thread' }),
    )
    expect(setQueryData).toHaveBeenCalled()
  })
})
