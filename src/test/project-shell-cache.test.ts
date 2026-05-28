import { describe, expect, it } from 'vitest'
import {
  removeShellWorktreeProject,
  setShellWorktreeCompleted,
  upsertShellWorktreeProject,
} from '../app/app-shell/project-shell-cache'
import type { ShellState } from '../app/desktop/types'
import type { Project } from '../app/types'

function project(id: string, overrides: Partial<Project> = {}): Project {
  return {
    id,
    name: id.split('/').at(-1) ?? id,
    threads: [],
    threadCount: 0,
    threadsLoaded: false,
    ...overrides,
  }
}

function shellState(projects: Project[]): ShellState {
  return {
    platform: 'test',
    mockMode: false,
    productName: 'howcode',
    cwd: '/repo',
    agentDir: '/agent',
    sessionDir: '/sessions',
    projects,
    sidebarVisibleProjectIds: null,
    appSettings: {} as ShellState['appSettings'],
    piSettings: {} as ShellState['piSettings'],
    piTheme: {
      selectedTheme: 'test',
      themes: [],
      colors: {},
      exportColors: {},
      isLight: false,
      diagnostics: [],
    },
    composer: {} as ShellState['composer'],
  }
}

function createQueryClient(initialState: ShellState) {
  let state: ShellState | null = initialState
  return {
    get state() {
      return state
    },
    setQueryData: (_queryKey: readonly unknown[], updater: (current: unknown) => unknown) => {
      state = updater(state) as ShellState | null
    },
  }
}

describe('project shell cache patches', () => {
  it('inserts a worktree without replacing unrelated project objects', () => {
    const root = project('/repo', { threadsLoaded: true })
    const other = project('/other', { threadsLoaded: true })
    const queryClient = createQueryClient(shellState([root, other]))

    upsertShellWorktreeProject(queryClient, {
      rootProjectId: '/repo',
      worktreeProjectId: '/repo/.worktrees/feature',
      branchName: 'feature',
      parentBranchName: 'main',
    })

    expect(queryClient.state?.projects.find((candidate) => candidate.id === '/other')).toBe(other)
    expect(queryClient.state?.projects.find((candidate) => candidate.id === '/repo')).not.toBe(root)
    expect(
      queryClient.state?.projects.find((candidate) => candidate.id === '/repo/.worktrees/feature')
        ?.worktree,
    ).toMatchObject({ rootProjectId: '/repo', branchName: 'feature', parentBranchName: 'main' })
  })

  it('updates and removes only the targeted worktree row', () => {
    const root = project('/repo')
    const worktree = project('/repo/.worktrees/feature', {
      worktree: {
        rootProjectId: '/repo',
        branchName: 'feature',
        parentBranchName: 'main',
        isMain: false,
        source: 'howcode',
        completed: false,
      },
    })
    const other = project('/other')
    const queryClient = createQueryClient(shellState([root, worktree, other]))

    setShellWorktreeCompleted(queryClient, worktree.id, true)

    expect(queryClient.state?.projects.find((candidate) => candidate.id === '/repo')).toBe(root)
    expect(queryClient.state?.projects.find((candidate) => candidate.id === '/other')).toBe(other)
    expect(
      queryClient.state?.projects.find((candidate) => candidate.id === worktree.id)?.worktree
        ?.completed,
    ).toBe(true)

    removeShellWorktreeProject(queryClient, worktree.id)

    expect(queryClient.state?.projects.map((candidate) => candidate.id)).toEqual([
      '/repo',
      '/other',
    ])
    expect(queryClient.state?.projects.find((candidate) => candidate.id === '/repo')).toBe(root)
    expect(queryClient.state?.projects.find((candidate) => candidate.id === '/other')).toBe(other)
  })
})
