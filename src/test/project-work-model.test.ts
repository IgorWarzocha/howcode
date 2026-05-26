import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  bucketThreads,
  buildBranchGroups,
  filterBranchGroups,
  getProjectScopeLabel,
  getVisibleProjectIds,
  projectBlockMatchesSearch,
  UNASSIGNED_BRANCH_GROUP_ID,
} from '../app/components/sidebar/project-work/project-work-model'
import type { Project, Thread } from '../app/types'

function thread(overrides: Partial<Thread> & Pick<Thread, 'id'>): Thread {
  return {
    title: overrides.id,
    age: 'Now',
    ...overrides,
  }
}

function project(overrides: Partial<Project> & Pick<Project, 'id' | 'name'>): Project {
  return {
    threads: [],
    ...overrides,
  }
}

describe('project work sidebar model', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps selected, pinned, running, unread, and recent threads active', () => {
    vi.setSystemTime(new Date('2026-05-25T00:00:00Z'))

    const old = Date.now() - 8 * 24 * 60 * 60 * 1000
    const recent = Date.now() - 2 * 24 * 60 * 60 * 1000
    const buckets = bucketThreads(
      project({
        id: 'project-a',
        name: 'Project A',
        threads: [
          thread({ id: 'old', lastModifiedMs: old }),
          thread({ id: 'recent', lastModifiedMs: recent }),
          thread({ id: 'selected', lastModifiedMs: old }),
          thread({ id: 'pinned', pinned: true, lastModifiedMs: old }),
          thread({ id: 'running', running: true, lastModifiedMs: old }),
          thread({ id: 'unread', unread: true, lastModifiedMs: old }),
        ],
      }),
      'selected',
    )

    expect(buckets.activeThreads.map((item) => item.id)).toEqual([
      'recent',
      'selected',
      'pinned',
      'running',
      'unread',
    ])
    expect(buckets.olderThreads.map((item) => item.id)).toEqual(['old'])
  })

  it('builds branch groups with current branch first and unassigned last', () => {
    const groups = buildBranchGroups(
      [
        thread({ id: 'feature-new', branchName: 'feature', lastModifiedMs: 30 }),
        thread({ id: 'main-thread', branchName: 'main', lastModifiedMs: 20 }),
        thread({ id: 'unassigned', lastModifiedMs: 10 }),
      ],
      'main',
      ['feature', 'release'],
    )

    expect(groups.map((group) => group.id)).toEqual([
      'main',
      'feature',
      'release',
      UNASSIGNED_BRANCH_GROUP_ID,
    ])
    expect(groups[0]).toMatchObject({ current: true, label: 'main' })
    expect(groups.at(-1)).toMatchObject({ unassigned: true, label: 'Unassigned' })
  })

  it('keeps present worktrees visible as branch-like groups', () => {
    const groups = buildBranchGroups(
      [],
      'main',
      ['main'],
      [{ label: 'feature/worktree', path: '/repo/.worktrees/feature-worktree' }],
    )

    expect(groups.map((group) => group.id)).toEqual(['main', 'feature/worktree'])
    expect(groups[1]).toMatchObject({
      label: 'feature/worktree',
      threads: [],
      worktree: true,
      worktreePath: '/repo/.worktrees/feature-worktree',
      worktrees: [],
    })
  })

  it('nests a worktree under a branch only when the branch has its own threads', () => {
    const groups = buildBranchGroups(
      [thread({ id: 'branch-thread', branchName: 'feature', lastModifiedMs: 20 })],
      'main',
      ['main', 'feature'],
      [{ label: 'feature', path: '/repo/.worktrees/feature', branchName: 'feature' }],
    )

    expect(groups[1]).toMatchObject({
      label: 'feature',
      threads: [{ id: 'branch-thread' }],
      worktree: false,
      worktrees: [
        {
          label: 'feature',
          path: '/repo/.worktrees/feature',
          threads: [],
        },
      ],
    })
  })

  it('sorts present worktrees before inactive branch-only groups', () => {
    const groups = buildBranchGroups(
      [],
      'main',
      ['main', 'zzz-branch'],
      [{ label: 'aaa-worktree', path: '/repo/.worktrees/aaa-worktree' }],
    )

    expect(groups.map((group) => group.id)).toEqual(['main', 'aaa-worktree', 'zzz-branch'])
  })

  it('marks completed worktree-only groups as complete', () => {
    const groups = buildBranchGroups(
      [],
      'main',
      ['main'],
      [
        {
          label: 'done-worktree',
          path: '/repo/.worktrees/done-worktree',
          complete: true,
        },
      ],
    )

    expect(groups[1]).toMatchObject({
      worktree: true,
      worktreeComplete: true,
      worktreePath: '/repo/.worktrees/done-worktree',
    })
  })

  it('filters branch groups by branch label or matching thread content', () => {
    const groups = buildBranchGroups(
      [
        thread({ id: 'one', title: 'Fix parser', branchName: 'main' }),
        thread({ id: 'two', title: 'Polish sidebar', branchName: 'ui' }),
      ],
      'main',
      ['ui'],
    )

    expect(filterBranchGroups(groups, 'sidebar').map((group) => group.id)).toEqual(['ui'])
    expect(filterBranchGroups(groups, 'main').map((group) => group.id)).toEqual(['main'])
  })

  it('matches project blocks from filtered branch groups, including non-current branches', () => {
    const groups = buildBranchGroups(
      [
        thread({ id: 'one', title: 'Fix parser', branchName: 'main' }),
        thread({ id: 'two', title: 'Polish sidebar', branchName: 'feature' }),
      ],
      'main',
      ['feature'],
    )
    const filteredGroups = filterBranchGroups(groups, 'sidebar')

    expect(
      projectBlockMatchesSearch({
        branchGroups: filteredGroups,
        normalizedSearchQuery: 'sidebar',
        projectName: 'Compiler',
      }),
    ).toBe(true)
    expect(filteredGroups.map((group) => group.id)).toEqual(['feature'])
  })

  it('derives visible project ids from stored, initial, or selected project state', () => {
    const selected = project({ id: 'project-a', name: 'Project A' })

    expect(getVisibleProjectIds(['stored'], ['initial'], selected)).toEqual(['stored'])
    expect(getVisibleProjectIds(null, ['initial'], selected)).toEqual(['initial'])
    expect(getVisibleProjectIds(null, null, selected)).toEqual(['project-a'])
    expect(getVisibleProjectIds(null, undefined, selected)).toEqual([])
  })

  it('labels project scope using selected visible project when possible', () => {
    const alpha = project({ id: 'alpha', name: 'Alpha' })
    const beta = project({ id: 'beta', name: 'Beta' })

    expect(getProjectScopeLabel({ selectedProject: beta, visibleProjects: [alpha, beta] })).toBe(
      'Beta +1',
    )
    expect(getProjectScopeLabel({ selectedProject: null, visibleProjects: [] })).toBe(
      'No projects selected',
    )
  })
})
