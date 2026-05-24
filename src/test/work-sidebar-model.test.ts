import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  bucketThreads,
  buildBranchGroups,
  filterBranchGroups,
  getProjectScopeLabel,
  getVisibleProjectIds,
  UNASSIGNED_BRANCH_GROUP_ID,
} from '../app/components/sidebar/work/work-sidebar-model'
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

describe('work sidebar model', () => {
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
