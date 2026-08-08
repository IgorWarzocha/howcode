import { describe, expect, it } from 'vitest'
import {
  branchGroupBelongsToBranch,
  buildBranchGroups,
} from '../app/components/sidebar/project-work/branch-group-model'
import {
  getDisplayableProjects,
  getDisplayableWorkspaces,
  getVisibleProjectIds,
} from '../app/components/sidebar/project-work/project-scope-model'
import { getThreadBucketsForProjectWork } from '../app/components/sidebar/project-work/project-thread-model'
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

describe('sidebar project work model boundaries', () => {
  it('keeps worktrees out of project scope without hiding them as workspaces', () => {
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

    expect(getDisplayableProjects([root, worktree])).toEqual([root])
    expect(getDisplayableWorkspaces([root, worktree])).toEqual([root, worktree])
    expect(getVisibleProjectIds(null, null, root)).toEqual(['/repo'])
    expect(getVisibleProjectIds(null, undefined, root)).toEqual([])
  })

  it('preserves worktree identity from project threads into branch groups', () => {
    const root = project({ id: '/repo', name: 'Repo' })
    const worktree = project({
      id: '/repo/.worktrees/feature',
      name: 'Repo feature',
      threads: [thread({ id: 'feature-thread', branchName: 'stale', lastModifiedMs: Date.now() })],
      worktree: {
        isMain: false,
        rootProjectId: '/repo',
        branchName: 'feature',
        source: 'howcode',
      },
    })

    const buckets = getThreadBucketsForProjectWork(root, [root, worktree], null)
    const groups = buildBranchGroups(
      buckets.activeThreads,
      'main',
      ['main', 'feature'],
      [
        {
          label: 'feature',
          path: worktree.id,
          branchName: 'feature',
        },
      ],
    )

    expect(groups[1]).toMatchObject({
      id: 'feature',
      worktrees: [
        {
          path: worktree.id,
          threads: [{ id: 'feature-thread', branchName: 'feature' }],
        },
      ],
    })
    expect(branchGroupBelongsToBranch(groups[1]!, 'feature')).toBe(true)
    expect(branchGroupBelongsToBranch(groups[1]!, 'main')).toBe(false)
  })

  it('keeps completed worktrees with their owning branch', () => {
    const nestedGroups = buildBranchGroups(
      [],
      'dev',
      ['dev', 'feature'],
      [
        {
          label: 'feature',
          path: '/repo/.worktrees/feature',
          branchName: 'feature',
          parentBranchName: 'dev',
        },
      ],
    )
    expect(nestedGroups).toMatchObject([
      {
        id: 'dev',
        worktrees: [{ branchName: 'feature', parentBranchName: 'dev' }],
      },
    ])

    const unrelatedGroups = buildBranchGroups(
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
    expect(unrelatedGroups[0]?.completedWorktrees).toBeUndefined()
    expect(unrelatedGroups[1]).toMatchObject({
      id: 'dashboard',
      worktrees: [{ branchName: 'dashboard', complete: true }],
    })
  })
})
