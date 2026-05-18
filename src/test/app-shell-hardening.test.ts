import { describe, expect, it } from 'vitest'
import {
  getOptimisticallyPinnedShellState,
  getOptimisticallyUpdatedPiSettingsState,
  getOptimisticallyUpdatedShellState,
} from '../app/app-shell/controller-optimistic-updates'
import { applyDiffPreferencesToThread } from '../app/app-shell/controller-post-action-effects'
import { getDiffPreferencesPatch } from '../app/app-shell/post-effects/diff-preferences'
import type { ThreadData } from '../app/desktop/types'

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
})
