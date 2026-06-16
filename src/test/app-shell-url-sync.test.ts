import { describe, expect, it } from 'vitest'
import {
  type AppRouteSnapshot,
  shouldDeferStateRouteNavigation,
} from '../app/app-shell/useAppShellUrlSync'
import type { Project } from '../app/types'

function createProject(threadIds: string[] = []): Project {
  return {
    id: '/repo/project-a',
    name: 'project-a',
    threads: threadIds.map((id) => ({
      id,
      title: id,
      age: 'now',
      sessionPath: `/sessions/${id}.jsonl`,
    })),
  }
}

function route(threadId: string): AppRouteSnapshot {
  return {
    pathname: '/thread',
    search: { projectId: '/repo/project-a', threadId },
  }
}

describe('app shell URL sync', () => {
  it('does not let a stale missing thread route block state-driven URL replacement', () => {
    expect(
      shouldDeferStateRouteNavigation({
        projects: [createProject(['persisted-thread'])],
        routeChanged: false,
        routeSnapshot: route('local-thread-stale'),
        stateChanged: true,
      }),
    ).toBe(false)
  })

  it('still waits when the browser navigates to a missing thread route', () => {
    expect(
      shouldDeferStateRouteNavigation({
        projects: [createProject(['persisted-thread'])],
        routeChanged: true,
        routeSnapshot: route('missing-thread'),
        stateChanged: true,
      }),
    ).toBe(true)
  })

  it('does not navigate when state did not change', () => {
    expect(
      shouldDeferStateRouteNavigation({
        projects: [createProject(['persisted-thread'])],
        routeChanged: false,
        routeSnapshot: route('persisted-thread'),
        stateChanged: false,
      }),
    ).toBe(true)
  })
})
