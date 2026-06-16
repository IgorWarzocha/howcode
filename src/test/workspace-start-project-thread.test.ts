import { describe, expect, it } from 'vitest'
import { createLocalThreadDraft } from '../../shared/session-paths'
import { type WorkspaceState, workspaceReducer } from '../app/state/workspace'

function createWorkspaceState(overrides: Partial<WorkspaceState> = {}): WorkspaceState {
  return {
    activeView: 'project',
    selectedProjectId: '/repo/project-a',
    hasSelectedProject: true,
    landingVisible: false,
    selectedInboxSessionPath: null,
    selectedThreadId: null,
    selectedSessionPath: null,
    terminalVisible: false,
    workspaceTerminalVisibleByWorkspace: {},
    terminalVisibleBySession: {},
    restoreTerminalVisibleOnGitOpsClose: false,
    takeoverVisible: false,
    takeoverOverrides: {},
    gitOpsReturnView: 'project',
    selectedDiffFilePath: null,
    utilityViewReturnState: null,
    settingsOpen: false,
    settingsPanelOpen: false,
    collapsedProjectIds: {},
    lastCodeThreadSelection: null,
    ...overrides,
  }
}

describe('start-project-thread state', () => {
  it('migrates local draft terminal and takeover state to the persisted project thread', () => {
    const draft = createLocalThreadDraft('/repo/project-a', 'draft')
    const persistedSessionPath = '/sessions/project-a/thread.jsonl'

    const next = workspaceReducer(
      createWorkspaceState({
        selectedThreadId: draft.threadId,
        selectedSessionPath: draft.sessionPath,
        terminalVisible: true,
        terminalVisibleBySession: { [draft.sessionPath]: true },
        takeoverVisible: true,
        takeoverOverrides: { [draft.sessionPath]: true },
      }),
      {
        type: 'start-project-thread',
        projectId: draft.projectId,
        threadId: 'persisted-thread-1',
        sessionPath: persistedSessionPath,
      },
    )

    expect(next.activeView).toBe('project')
    expect(next.selectedSessionPath).toBe(persistedSessionPath)
    expect(next.terminalVisible).toBe(true)
    expect(next.terminalVisibleBySession[persistedSessionPath]).toBe(true)
    expect(next.takeoverVisible).toBe(true)
    expect(next.takeoverOverrides[persistedSessionPath]).toBe(true)
    expect(next.lastCodeThreadSelection).toEqual({
      projectId: draft.projectId,
      threadId: 'persisted-thread-1',
      sessionPath: persistedSessionPath,
    })
  })

  it('remembers a code thread while visiting chat and restores it from the Code tab', () => {
    const codeSessionPath = '/sessions/project-a/code-thread.jsonl'
    const chatState = workspaceReducer(
      createWorkspaceState({
        activeView: 'thread',
        selectedThreadId: 'code-thread-1',
        selectedSessionPath: codeSessionPath,
      }),
      { type: 'show-view', view: 'chat' },
    )

    expect(chatState.activeView).toBe('chat')
    expect(chatState.selectedThreadId).toBeNull()
    expect(chatState.selectedSessionPath).toBeNull()
    expect(chatState.lastCodeThreadSelection).toEqual({
      projectId: '/repo/project-a',
      threadId: 'code-thread-1',
      sessionPath: codeSessionPath,
    })

    const restored = workspaceReducer(chatState, { type: 'show-view', view: 'code' })

    expect(restored.activeView).toBe('thread')
    expect(restored.selectedProjectId).toBe('/repo/project-a')
    expect(restored.selectedThreadId).toBe('code-thread-1')
    expect(restored.selectedSessionPath).toBe(codeSessionPath)
  })

  it('does not replace the remembered code thread when opening a chat thread', () => {
    const codeSelection = {
      projectId: '/repo/project-a',
      threadId: 'code-thread-1',
      sessionPath: '/sessions/project-a/code-thread.jsonl',
    }
    const chatThreadState = workspaceReducer(
      createWorkspaceState({ activeView: 'chat', lastCodeThreadSelection: codeSelection }),
      {
        type: 'open-thread',
        projectId: '/repo/project-a',
        threadId: 'chat-thread-1',
        sessionPath: '/chat-sessions/chat-thread.jsonl',
        view: 'chat',
      },
    )

    expect(chatThreadState.activeView).toBe('chat')
    expect(chatThreadState.selectedThreadId).toBe('chat-thread-1')
    expect(chatThreadState.lastCodeThreadSelection).toEqual(codeSelection)
  })
})
