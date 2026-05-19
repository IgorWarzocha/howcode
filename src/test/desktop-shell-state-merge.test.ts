import { describe, expect, it } from 'vitest'
import type { ShellState } from '../app/desktop/types'
import { mergeShellStateProjects } from '../app/hooks/useDesktopShellStateQuery'

function shellState(projects: ShellState['projects']): ShellState {
  return {
    platform: 'linux',
    mockMode: false,
    productName: 'howcode',
    cwd: '/repo/project-a',
    agentDir: '/agent',
    sessionDir: '/sessions',
    projects,
    appSettings: {} as ShellState['appSettings'],
    piSettings: {} as ShellState['piSettings'],
    piTheme: {} as ShellState['piTheme'],
    composer: {} as ShellState['composer'],
  }
}

describe('desktop shell state merge', () => {
  it('keeps loaded thread lists when shell refresh has no newer project activity', () => {
    const current = shellState([
      {
        id: '/repo/project-a',
        name: 'project-a',
        collapsed: false,
        threadsLoaded: true,
        threadsScope: 'code',
        threadCount: 1,
        latestModifiedMs: 100,
        threads: [
          {
            id: 'thread-1',
            title: 'Cached thread',
            age: 'Now',
            sessionPath: '/sessions/thread-1.jsonl',
          },
        ],
      },
    ])
    const next = shellState([
      {
        id: '/repo/project-a',
        name: 'project-a',
        collapsed: true,
        threadsLoaded: false,
        threadCount: 1,
        latestModifiedMs: 100,
        threads: [],
      },
    ])

    expect(mergeShellStateProjects(current, next)?.projects[0]).toMatchObject({
      collapsed: true,
      threadsLoaded: true,
      threads: current.projects[0]?.threads,
    })
  })

  it('marks loaded thread lists stale when shell refresh reports a newer thread', () => {
    const current = shellState([
      {
        id: '/repo/project-a',
        name: 'project-a',
        collapsed: false,
        threadsLoaded: true,
        threadsScope: 'code',
        threadCount: 1,
        latestModifiedMs: 100,
        threads: [
          {
            id: 'local-thread-1',
            title: 'New thread',
            age: 'Now',
            sessionPath: 'local://%2Frepo%2Fproject-a/draft',
          },
        ],
      },
    ])
    const next = shellState([
      {
        id: '/repo/project-a',
        name: 'project-a',
        collapsed: true,
        threadsLoaded: false,
        threadCount: 2,
        latestModifiedMs: 200,
        threads: [],
      },
    ])

    expect(mergeShellStateProjects(current, next)?.projects[0]).toMatchObject({
      collapsed: false,
      threadsLoaded: false,
      threads: [],
      threadCount: 2,
      latestModifiedMs: 200,
    })
  })
})
