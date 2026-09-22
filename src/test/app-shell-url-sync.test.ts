import { describe, expect, it } from 'vitest'
import {
  type AppRouteSnapshot,
  getAppShellUrlSyncDecision,
} from '../app/app-shell/useAppShellUrlSync'
import type { Project } from '../app/types'

const landingRoute: AppRouteSnapshot = { pathname: '/', search: {} }
const initialCursor = { routeKey: null, stateKey: null }

function createProject(options: {
  threadIds?: string[] | undefined
  threadsLoaded: boolean
  threadsScope?: 'chat' | 'code' | undefined
}): Project {
  return {
    id: '/repo/project-a',
    name: 'project-a',
    threads: (options.threadIds ?? []).map((id) => ({
      id,
      title: id,
      age: 'now',
      sessionPath: `/sessions/${id}.jsonl`,
    })),
    threadsLoaded: options.threadsLoaded,
    threadsScope: options.threadsScope,
  }
}

function threadRoute(pathname: '/chat' | '/thread'): AppRouteSnapshot {
  return {
    pathname,
    search: { projectId: '/repo/project-a', threadId: 'deleted-thread' },
  }
}

function decide(routeSnapshot: AppRouteSnapshot, projects: Project[], shellLoading = false) {
  return getAppShellUrlSyncDecision({
    previous: initialCursor,
    projects,
    routeHydration: null,
    routeSnapshot,
    shellLoading,
    stateRoute: landingRoute,
  })
}

describe('app shell URL sync state', () => {
  it('defers missing threads while the shell is loading', () => {
    expect(decide(threadRoute('/thread'), [], true).type).toBe('defer')
  })

  it.each([
    ['/thread', false, undefined, 'code'],
    ['/thread', true, 'chat', 'code'],
    ['/chat', true, 'code', 'chat'],
  ] as const)(
    'starts the relevant scope hydration for %s instead of deferring forever',
    (pathname, threadsLoaded, threadsScope, scope) => {
      expect(
        decide(threadRoute(pathname), [createProject({ threadsLoaded, threadsScope })]),
      ).toMatchObject({
        type: 'hydrate-route-scope',
        projectId: '/repo/project-a',
        scope,
      })
    },
  )

  it.each([
    ['/thread', 'code'],
    ['/chat', 'chat'],
  ] as const)(
    'falls back from a missing %s thread after its %s scope has loaded and advances the cursor',
    (pathname, threadsScope) => {
      const routeSnapshot = threadRoute(pathname)
      const decision = decide(routeSnapshot, [createProject({ threadsLoaded: true, threadsScope })])

      expect(decision).toEqual({
        type: 'navigate-state',
        next: {
          routeKey: JSON.stringify(routeSnapshot),
          stateKey: JSON.stringify(landingRoute),
        },
      })
    },
  )

  it('falls back when the shell has loaded without the target project', () => {
    expect(decide(threadRoute('/thread'), [])).toMatchObject({ type: 'navigate-state' })
  })

  it('replaces a deleted thread browser-history route when workspace state is unchanged', () => {
    const routeSnapshot = threadRoute('/thread')
    const stateKey = JSON.stringify(landingRoute)

    expect(
      getAppShellUrlSyncDecision({
        previous: { routeKey: stateKey, stateKey },
        projects: [createProject({ threadsLoaded: true, threadsScope: 'code' })],
        routeHydration: null,
        routeSnapshot,
        shellLoading: false,
        stateRoute: landingRoute,
      }),
    ).toEqual({
      type: 'navigate-state',
      next: { routeKey: JSON.stringify(routeSnapshot), stateKey },
    })
  })

  it('abandons initial route hydration when workspace navigation changes the state route', () => {
    const routeSnapshot = threadRoute('/thread')
    const hydration = decide(routeSnapshot, [createProject({ threadsLoaded: false })])
    expect(hydration.type).toBe('hydrate-route-scope')
    if (hydration.type !== 'hydrate-route-scope') return

    const settingsRoute: AppRouteSnapshot = { pathname: '/settings', search: {} }
    const expected = {
      type: 'navigate-state',
      next: {
        routeKey: JSON.stringify(routeSnapshot),
        stateKey: JSON.stringify(settingsRoute),
      },
    }
    const pendingProject = createProject({ threadsLoaded: false })
    const hydratedProject = createProject({
      threadIds: ['deleted-thread'],
      threadsLoaded: true,
      threadsScope: 'code',
    })

    for (const projects of [[pendingProject], [hydratedProject]]) {
      expect(
        getAppShellUrlSyncDecision({
          previous: initialCursor,
          projects,
          routeHydration: hydration.intent,
          routeSnapshot,
          shellLoading: false,
          stateRoute: settingsRoute,
        }),
      ).toEqual(expected)
    }
  })

  it('dispatches an initial deep link after its route scope hydrates', () => {
    const routeSnapshot = threadRoute('/thread')
    const hydration = decide(routeSnapshot, [createProject({ threadsLoaded: false })])
    expect(hydration.type).toBe('hydrate-route-scope')
    if (hydration.type !== 'hydrate-route-scope') return

    expect(
      getAppShellUrlSyncDecision({
        previous: initialCursor,
        projects: [
          createProject({
            threadIds: ['deleted-thread'],
            threadsLoaded: true,
            threadsScope: 'code',
          }),
        ],
        routeHydration: hydration.intent,
        routeSnapshot,
        shellLoading: false,
        stateRoute: landingRoute,
      }),
    ).toMatchObject({
      type: 'dispatch-route',
      action: {
        type: 'open-thread',
        projectId: '/repo/project-a',
        threadId: 'deleted-thread',
        view: 'thread',
      },
    })
  })
})
