import { describe, expect, it } from 'vitest'
import {
  createBlockedBranchResumeResult,
  getBranchResumeGuardCheck,
} from '../app/app-shell/branch-resume-guard'
import {
  getOptimisticallyPinnedShellState,
  getOptimisticallyUpdatedPiSettingsState,
  getOptimisticallyUpdatedShellState,
} from '../app/app-shell/controller-optimistic-updates'
import { applyDiffPreferencesToThread } from '../app/app-shell/controller-post-action-effects'
import { deriveControllerViewModel } from '../app/app-shell/controller-view-model'
import { getDiffPreferencesPatch } from '../app/app-shell/post-effects/diff-preferences'
import type { ThreadData } from '../app/desktop/types'
import type { WorkspaceState } from '../app/state/workspace'

function createShellState() {
  return {
    appSettings: {
      favoriteFolders: ['/repo'],
      keybindings: {},
      gitDiffBaselineDefault: { kind: 'head' },
    },
    piSettings: {
      theme: 'dark',
      editorPaddingX: 1,
      autocompleteMaxVisible: 5,
      imageWidthCells: 80,
    },
    projects: [
      {
        id: '/repo/a',
        name: 'a',
        threads: [
          { id: 'thread-a', title: 'A', age: 'now', pinned: false },
          { id: 'thread-b', title: 'B', age: 'now', pinned: true },
        ],
      },
      { id: '/repo/b', name: 'b', pinned: false, threads: [] },
    ],
  } as never
}

function createWorkspaceState(overrides: Partial<WorkspaceState> = {}): WorkspaceState {
  return {
    activeView: 'project',
    selectedProjectId: '',
    hasSelectedProject: false,
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
    ...overrides,
  }
}

describe('app shell hardening helpers', () => {
  it('normalizes optimistic settings instead of caching invalid payload shapes', () => {
    const state = createShellState()

    expect(
      getOptimisticallyUpdatedShellState(state, {
        key: 'favoriteFolders',
        folders: ['/repo', '  /new  ', '', '/new'],
      })?.appSettings.favoriteFolders,
    ).toEqual(['/repo', '/new'])

    expect(
      getOptimisticallyUpdatedShellState(state, {
        key: 'keybindings',
        value: { 'thread.new': 'CmdOrCtrl+N', nope: 'CmdOrCtrl+X' },
      })?.appSettings.keybindings,
    ).toEqual({ 'thread.new': 'CmdOrCtrl+N' })
  })

  it('clamps optimistic Pi numeric settings at the shared shell boundary', () => {
    expect(
      getOptimisticallyUpdatedPiSettingsState(createShellState(), {
        piSettingsKey: 'autocompleteMaxVisible',
        value: 99,
      })?.piSettings.autocompleteMaxVisible,
    ).toBe(20)
  })

  it('keeps pinned threads sorted after optimistic pin toggles', () => {
    const nextState = getOptimisticallyPinnedShellState(createShellState(), 'thread.pin', {
      projectId: '/repo/a',
      threadId: 'thread-a',
    })

    expect(nextState?.projects[0]?.threads.map((thread) => [thread.id, thread.pinned])).toEqual([
      ['thread-a', true],
      ['thread-b', true],
    ])
  })

  it('guards branch-assigned session resumes before sending into the wrong branch', () => {
    const shellState = {
      projects: [
        {
          id: '/repo/a',
          name: 'a',
          threads: [
            {
              id: 'thread-a',
              title: 'A',
              age: 'now',
              sessionPath: '/sessions/a.jsonl',
              branchName: 'feature-a',
            },
          ],
        },
      ],
    } as never

    expect(
      getBranchResumeGuardCheck({
        shellState,
        payload: { projectId: '/repo/a', sessionPath: '/sessions/a.jsonl' },
        gitState: { projectId: '/repo/a', branch: 'dev' } as never,
      }),
    ).toEqual({
      currentBranch: 'dev',
      projectId: '/repo/a',
      shouldSwitch: true,
      targetBranch: 'feature-a',
    })
  })

  it('does not guard worktree sessions because their project id is already the cwd', () => {
    const shellState = {
      projects: [
        {
          id: '/repo/a/.worktrees/feature-a',
          name: 'feature-a',
          worktree: {
            rootProjectId: '/repo/a',
            branchName: 'feature-a',
            isMain: false,
            source: 'howcode',
          },
          threads: [
            {
              id: 'thread-a',
              title: 'A',
              age: 'now',
              sessionPath: '/sessions/a.jsonl',
              branchName: 'feature-a',
            },
          ],
        },
      ],
    } as never

    expect(
      getBranchResumeGuardCheck({
        shellState,
        payload: { projectId: '/repo/a/.worktrees/feature-a', sessionPath: '/sessions/a.jsonl' },
        gitState: { projectId: '/repo/a/.worktrees/feature-a', branch: 'feature-a' } as never,
      }),
    ).toEqual({ shouldSwitch: false })
  })

  it('formats dirty branch resume guard errors without clearing the composer draft', () => {
    expect(
      createBlockedBranchResumeResult({
        action: 'composer.send',
        currentBranch: 'dev',
        targetBranch: 'feature-a',
        payload: { projectId: '/repo/a', sessionPath: '/sessions/a.jsonl', text: 'ship it' },
      }).result?.error,
    ).toBe('dev has uncommitted changes. Commit them first, then resend your prompt.')
  })

  it('rejects invalid diff preference payloads before cache mutation', () => {
    expect(
      getDiffPreferencesPatch({
        sessionPath: '/sessions/thread.jsonl',
        diffBaseline: { kind: 'commit', sha: '' },
      }),
    ).toBeNull()

    expect(
      getDiffPreferencesPatch({
        sessionPath: '/sessions/thread.jsonl',
        diffRenderMode: 'sideways',
      } as never),
    ).toBeNull()
  })

  it('patches diff preferences without dropping untouched fields', () => {
    const thread = {
      sessionPath: '/sessions/thread.jsonl',
      diffPreferences: { baseline: { kind: 'head' }, renderMode: 'split' },
    } as ThreadData

    expect(
      applyDiffPreferencesToThread(thread, {
        hasBaseline: true,
        hasRenderMode: false,
        nextBaseline: { kind: 'previous' },
        nextRenderMode: null,
      })?.diffPreferences,
    ).toEqual({ baseline: { kind: 'previous' }, renderMode: 'split' })
  })

  it('keeps selected project cwd for composer actions while project list is stale', () => {
    const viewModel = deriveControllerViewModel({
      projects: [],
      workspaceState: createWorkspaceState({
        selectedProjectId: '/home/igorw/Work/howcode',
        hasSelectedProject: true,
      }),
      threadData: null,
      shellCwd: '/home/igorw',
      composerState: null,
      shellComposerState: null,
    })

    expect(viewModel.composerProjectId).toBe('/home/igorw/Work/howcode')
    expect(viewModel.currentProjectName).toBe('howcode')
  })
})
