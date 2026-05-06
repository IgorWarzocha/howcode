import { describe, expect, it } from 'vitest'
import {
  applyProjectThreadToShellState,
  getDraftReplacementSessionPath,
  removeProjectThreadFromShellState,
} from '../app/app-shell/project-thread-cache'
import type { ShellState } from '../app/desktop/types'
import { desktopQueryKeys } from '../app/query/desktop-query'

function createShellState(): ShellState {
  return {
    platform: 'linux',
    mockMode: false,
    productName: 'howcode',
    cwd: '/repo/project-a',
    resolvedCwd: '/repo/project-a',
    agentDir: '/agent',
    sessionDir: '/sessions',
    appSettings: {},
    piSettings: {},
    composer: null,
    projects: [
      {
        id: '/repo/project-a',
        name: 'project-a',
        threads: [],
        threadCount: 0,
        threadsLoaded: false,
        collapsed: true,
      },
    ],
  } as unknown as ShellState
}

function createQueryClient(state: ShellState | null) {
  let current = state

  return {
    queryClient: {
      setQueryData: (queryKey: readonly unknown[], updater: (value: unknown) => unknown) => {
        if (JSON.stringify(queryKey) !== JSON.stringify(desktopQueryKeys.shellState())) {
          throw new Error(`Unexpected query key: ${JSON.stringify(queryKey)}`)
        }
        current = updater(current) as ShellState | null
      },
    },
    getState: () => current,
  }
}

describe('project thread shell cache helpers', () => {
  it('adds an optimistic thread to an unloaded project so the sidebar can render it immediately', () => {
    const { queryClient, getState } = createQueryClient(createShellState())

    applyProjectThreadToShellState(queryClient, '/repo/project-a', {
      id: 'local-thread-1',
      title: 'New thread',
      age: 'Now',
      lastModifiedMs: 100,
      sessionPath: 'local:///repo/project-a/1',
    })

    const project = getState()?.projects[0]
    expect(project?.threadsLoaded).toBe(true)
    expect(project?.collapsed).toBe(true)
    expect(project?.threads).toMatchObject([
      { id: 'local-thread-1', sessionPath: 'local:///repo/project-a/1' },
    ])
  })

  it('replaces a local draft with the persisted thread instead of duplicating it', () => {
    const shellState = createShellState()
    shellState.projects[0] = {
      ...shellState.projects[0]!,
      ...shellState.projects[0],
      threadsLoaded: true,
      threads: [
        {
          id: 'local-thread-1',
          title: 'New thread',
          age: 'Now',
          sessionPath: 'local:///repo/project-a/1',
        },
      ],
      threadCount: 1,
    }
    const { queryClient, getState } = createQueryClient(shellState)

    applyProjectThreadToShellState(
      queryClient,
      '/repo/project-a',
      {
        id: 'persisted-thread-1',
        title: 'Implement feature',
        age: 'Now',
        lastModifiedMs: 200,
        sessionPath: '/sessions/project-a/thread.jsonl',
        running: true,
      },
      { replaceSessionPath: 'local:///repo/project-a/1' },
    )

    expect(getState()?.projects[0]?.threads).toMatchObject([
      {
        id: 'persisted-thread-1',
        title: 'Implement feature',
        sessionPath: '/sessions/project-a/thread.jsonl',
        running: true,
      },
    ])
  })

  it('removes failed local drafts from the project thread cache', () => {
    const shellState = createShellState()
    shellState.projects[0] = {
      ...shellState.projects[0]!,
      ...shellState.projects[0],
      threadsLoaded: true,
      threads: [
        {
          id: 'local-thread-1',
          title: 'New thread',
          age: 'Now',
          sessionPath: 'local:///repo/project-a/1',
        },
      ],
      threadCount: 1,
    }
    const { queryClient, getState } = createQueryClient(shellState)

    removeProjectThreadFromShellState(queryClient, '/repo/project-a', 'local:///repo/project-a/1')

    expect(getState()?.projects[0]?.threads).toEqual([])
    expect(getState()?.projects[0]?.threadCount).toBe(0)
  })

  it('preserves indexed thread counts when removing failed drafts from unloaded projects', () => {
    const shellState = createShellState()
    shellState.projects[0] = {
      ...shellState.projects[0]!,
      ...shellState.projects[0],
      threadsLoaded: true,
      threads: [
        {
          id: 'local-thread-1',
          title: 'New thread',
          age: 'Now',
          sessionPath: 'local:///repo/project-a/1',
        },
      ],
      threadCount: 5,
    }
    const { queryClient, getState } = createQueryClient(shellState)

    removeProjectThreadFromShellState(queryClient, '/repo/project-a', 'local:///repo/project-a/1')

    expect(getState()?.projects[0]?.threads).toEqual([])
    expect(getState()?.projects[0]?.threadCount).toBe(5)
  })

  it('only marks selected local drafts from the same project for replacement', () => {
    expect(
      getDraftReplacementSessionPath(
        'local://%2Frepo%2Fproject-a/1',
        '/repo/project-a',
        '/repo/project-a',
      ),
    ).toBe('local://%2Frepo%2Fproject-a/1')

    expect(
      getDraftReplacementSessionPath(
        'local://%2Frepo%2Fproject-b/1',
        '/repo/project-b',
        '/repo/project-a',
      ),
    ).toBeNull()
  })
})
