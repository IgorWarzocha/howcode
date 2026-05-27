import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  branchGroupBelongsToBranch,
  bucketThreads,
  buildBranchGroups,
  filterBranchGroups,
  getDisplayableProjects,
  getDisplayableWorkspaces,
  getProjectScopeLabel,
  getThreadBucketsForProjectWork,
  getVisibleProjectIds,
  projectBlockMatchesSearch,
  UNASSIGNED_BRANCH_GROUP_ID,
} from '../app/components/sidebar/project-work/project-work-model'
import type { Project, Thread } from '../app/types'

function thread(
  overrides: Partial<Thread & { sidebarWorktreePath: string }> & Pick<Thread, 'id'>,
): Thread & { sidebarWorktreePath?: string | undefined } {
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

  it('buckets inactive worktree threads into older project work sessions with worktree context', () => {
    vi.setSystemTime(new Date('2026-05-25T00:00:00Z'))
    const old = Date.now() - 8 * 24 * 60 * 60 * 1000
    const root = project({
      id: '/repo',
      name: 'Repo',
      worktree: { isMain: true, rootProjectId: '/repo', branchName: 'main', source: 'howcode' },
    })
    const worktree = project({
      id: '/repo/.worktrees/feature',
      name: 'Repo feature',
      threads: [thread({ id: 'old-worktree-thread', lastModifiedMs: old })],
      worktree: {
        isMain: false,
        rootProjectId: '/repo',
        branchName: 'feature',
        source: 'howcode',
      },
    })

    const buckets = getThreadBucketsForProjectWork(root, [root, worktree], null)

    expect(buckets.activeThreads).toEqual([])
    expect(buckets.olderThreads).toMatchObject([
      {
        id: 'old-worktree-thread',
        branchName: 'feature',
        sidebarWorktreeLabel: 'feature',
        sidebarWorktreePath: '/repo/.worktrees/feature',
      },
    ])
  })

  it('uses the worktree branch over stale thread branch assignments', () => {
    const root = project({
      id: '/repo',
      name: 'Repo',
      worktree: { isMain: true, rootProjectId: '/repo', branchName: 'dev', source: 'howcode' },
    })
    const worktree = project({
      id: '/repo/.worktrees/post-worktree-fixes-automations',
      name: 'Repo post worktree fixes',
      threads: [
        thread({
          id: 'stale-thread-assignment',
          branchName: 'dev',
          lastModifiedMs: Date.now(),
        }),
      ],
      worktree: {
        isMain: false,
        rootProjectId: '/repo',
        branchName: 'post-worktree-fixes-automations',
        source: 'howcode',
      },
    })

    const buckets = getThreadBucketsForProjectWork(root, [root, worktree], null)
    const groups = buildBranchGroups(
      buckets.activeThreads,
      'dev',
      ['dev', 'post-worktree-fixes-automations'],
      [
        {
          label: 'post-worktree-fixes-automations',
          path: '/repo/.worktrees/post-worktree-fixes-automations',
          branchName: 'post-worktree-fixes-automations',
        },
      ],
    )

    expect(groups[0]).toMatchObject({ id: 'dev', worktrees: [] })
    expect(groups[1]).toMatchObject({
      id: 'post-worktree-fixes-automations',
      worktree: false,
      worktrees: [
        {
          threads: [
            { id: 'stale-thread-assignment', branchName: 'post-worktree-fixes-automations' },
          ],
        },
      ],
    })
    expect(branchGroupBelongsToBranch(groups[1]!, 'dev')).toBe(false)
    expect(branchGroupBelongsToBranch(groups[1]!, 'post-worktree-fixes-automations')).toBe(true)
  })

  it('does not attach completed worktrees from other branches to the current branch', () => {
    const groups = buildBranchGroups(
      [],
      'dev',
      ['dev', 'dashboard'],
      [
        {
          label: 'dashboard',
          path: '/repo/.worktrees/dashboard',
          branchName: 'dashboard',
          complete: true,
        },
      ],
    )

    expect(groups[0]?.id).toBe('dev')
    expect(groups[0]?.completedWorktrees).toBeUndefined()
    expect(groups[1]).toMatchObject({
      id: 'dashboard',
      worktree: false,
      worktrees: [
        {
          path: '/repo/.worktrees/dashboard',
          complete: true,
        },
      ],
    })
  })

  it('groups active worktrees under the parent branch session instead of duplicating branch rows', () => {
    const groups = buildBranchGroups(
      [thread({ id: 'parent-session', branchName: 'post-worktree-fixes-automations' })],
      'dev',
      ['dev', 'post-worktree-fixes-automations', 'dashboard', 'automations'],
      [
        { label: 'dashboard', path: '/repo/.worktrees/dashboard', branchName: 'dashboard' },
        { label: 'automations', path: '/repo/.worktrees/automations', branchName: 'automations' },
      ],
    )

    expect(groups.map((group) => group.id)).toEqual(['dev', 'post-worktree-fixes-automations'])
    expect(groups[1]).toMatchObject({
      id: 'post-worktree-fixes-automations',
      worktrees: [{ label: 'automations' }, { label: 'dashboard' }],
    })
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

  it('represents a branch checkout with no root sessions as a worktree row', () => {
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
      worktree: false,
      worktrees: [
        {
          label: 'feature/worktree',
          path: '/repo/.worktrees/feature-worktree',
        },
      ],
    })
  })

  it('nests a worktree under its branch when the branch has its own threads', () => {
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

  it('groups worktree threads by the worktree branch, not the root current branch', () => {
    const groups = buildBranchGroups(
      [
        thread({
          id: 'worktree-thread',
          branchName: 'feature/worktree',
          lastModifiedMs: 20,
          sidebarWorktreePath: '/repo/.worktrees/feature-worktree',
        }),
      ],
      'main',
      ['main'],
      [
        {
          label: 'feature/worktree',
          path: '/repo/.worktrees/feature-worktree',
          branchName: 'feature/worktree',
        },
      ],
    )

    expect(groups.map((group) => group.id)).toEqual(['main', 'feature/worktree'])
    expect(groups[1]).toMatchObject({
      worktree: false,
      worktrees: [{ threads: [{ id: 'worktree-thread' }] }],
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

  it('marks completed nested worktrees as complete', () => {
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
      worktree: false,
      worktrees: [
        {
          path: '/repo/.worktrees/done-worktree',
          complete: true,
        },
      ],
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

  it('keeps worktrees out of project-level sidebar lists while retaining them as workspaces', () => {
    const root = project({
      id: '/repo',
      name: 'Repo',
      worktree: { isMain: true, rootProjectId: '/repo', branchName: 'main', source: 'howcode' },
    })
    const worktree = project({
      id: '/repo/.worktrees/feature',
      name: 'Repo feature',
      worktree: {
        isMain: false,
        rootProjectId: '/repo',
        branchName: 'feature',
        source: 'howcode',
      },
    })

    expect(getDisplayableProjects([root, worktree]).map((item) => item.id)).toEqual(['/repo'])
    expect(getDisplayableWorkspaces([root, worktree]).map((item) => item.id)).toEqual([
      '/repo',
      '/repo/.worktrees/feature',
    ])
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
