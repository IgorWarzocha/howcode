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
    projectTerminalVisibleByProject: {},
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
  })
})
