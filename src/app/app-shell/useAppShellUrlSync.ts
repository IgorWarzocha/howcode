import { useRouter, useRouterState } from '@tanstack/react-router'
import { useEffect, useMemo, useRef } from 'react'
import type { WorkspaceAction, WorkspaceState } from '../state/workspace'
import type { Project, View } from '../types'

type NonGitOpsView = Exclude<View, 'gitops'>

type AppRouteSearch = Record<string, unknown>

type AppRouteSnapshot = {
  pathname: string
  search: AppRouteSearch
}

type AppShellUrlSyncInput = {
  dispatch: React.Dispatch<WorkspaceAction>
  projects: Project[]
  state: WorkspaceState
}

const leadingSlashesPattern = /^\/+/

const routeViews = new Set<NonGitOpsView>([
  'archived',
  'automations',
  'chat',
  'claw',
  'code',
  'extensions',
  'inbox',
  'settings',
  'sessions',
  'skills',
  'work',
])

function getStringSearchValue(search: AppRouteSearch, key: string) {
  const value = search[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

function findThread(projects: Project[], projectId: string | null, threadId: string | null) {
  if (!(projectId && threadId)) return null
  const project = projects.find((candidate) => candidate.id === projectId)
  const thread = project?.threads.find((candidate) => candidate.id === threadId) ?? null
  return project && thread?.sessionPath
    ? { project, thread, sessionPath: thread.sessionPath }
    : null
}

function getCurrentRoute(snapshot: AppRouteSnapshot) {
  const routeName = snapshot.pathname.replace(leadingSlashesPattern, '') || 'landing'
  const projectId = getStringSearchValue(snapshot.search, 'projectId')
  const threadId = getStringSearchValue(snapshot.search, 'threadId')
  const sessionPath = getStringSearchValue(snapshot.search, 'sessionPath')
  return { routeName, projectId, threadId, sessionPath }
}

function routesMatch(a: AppRouteSnapshot, b: AppRouteSnapshot) {
  return a.pathname === b.pathname && JSON.stringify(a.search) === JSON.stringify(b.search)
}

function cleanSearch(search: AppRouteSearch) {
  return Object.fromEntries(Object.entries(search).filter(([, value]) => value !== null))
}

function isRouteView(routeName: string): routeName is NonGitOpsView {
  return routeViews.has(routeName as NonGitOpsView)
}

function getRouteForState(state: WorkspaceState): AppRouteSnapshot {
  if (state.activeView === 'landing') return { pathname: '/', search: {} }
  if (state.activeView === 'project') {
    return { pathname: '/project', search: cleanSearch({ projectId: state.selectedProjectId }) }
  }
  if (state.activeView === 'thread') {
    return {
      pathname: '/thread',
      search: cleanSearch({ projectId: state.selectedProjectId, threadId: state.selectedThreadId }),
    }
  }
  if (state.activeView === 'chat') {
    return {
      pathname: '/chat',
      search: cleanSearch({ projectId: state.selectedProjectId, threadId: state.selectedThreadId }),
    }
  }
  if (state.activeView === 'gitops') {
    return {
      pathname: '/git',
      search: cleanSearch({ projectId: state.selectedProjectId, threadId: state.selectedThreadId }),
    }
  }
  if (state.activeView === 'inbox') {
    return {
      pathname: '/inbox',
      search: cleanSearch({ sessionPath: state.selectedInboxSessionPath }),
    }
  }

  return { pathname: `/${state.activeView}`, search: {} }
}

function getRouteAction(
  snapshot: AppRouteSnapshot,
  projects: Project[],
): WorkspaceAction | WorkspaceAction[] | null {
  const route = getCurrentRoute(snapshot)
  if (route.routeName === 'landing') return { type: 'show-landing' }
  if (route.routeName === 'project' && route.projectId) {
    return { type: 'select-project', projectId: route.projectId }
  }
  if (route.routeName === 'thread' || route.routeName === 'chat') {
    const thread = findThread(projects, route.projectId, route.threadId)
    if (!thread) return null
    return {
      type: 'open-thread',
      projectId: thread.project.id,
      threadId: thread.thread.id,
      sessionPath: thread.sessionPath,
      view: route.routeName,
    }
  }
  if (route.routeName === 'git') {
    const thread = findThread(projects, route.projectId, route.threadId)
    return thread
      ? [
          {
            type: 'open-thread',
            projectId: thread.project.id,
            threadId: thread.thread.id,
            sessionPath: thread.sessionPath,
          },
          { type: 'open-gitops' },
        ]
      : route.projectId
        ? [{ type: 'select-project', projectId: route.projectId }, { type: 'open-gitops' }]
        : { type: 'open-gitops' }
  }
  if (route.routeName === 'inbox') {
    return [
      { type: 'show-view', view: 'inbox' },
      { type: 'select-inbox-thread', sessionPath: route.sessionPath },
    ]
  }
  if (isRouteView(route.routeName)) {
    return { type: 'show-view', view: route.routeName }
  }
  return { type: 'show-landing' }
}

function isWaitingForRouteData(snapshot: AppRouteSnapshot, projects: Project[]) {
  const route = getCurrentRoute(snapshot)
  if (!(route.routeName === 'thread' || route.routeName === 'chat' || route.routeName === 'git')) {
    return false
  }
  if (!(route.projectId && route.threadId)) {
    return false
  }

  return !findThread(projects, route.projectId, route.threadId)
}

function dispatchRouteAction(
  dispatch: React.Dispatch<WorkspaceAction>,
  action: WorkspaceAction | WorkspaceAction[],
) {
  for (const item of Array.isArray(action) ? action : [action]) {
    dispatch(item)
  }
}

export function useAppShellUrlSync({ dispatch, projects, state }: AppShellUrlSyncInput) {
  const router = useRouter()
  const snapshot = useRouterState({
    select: (routerState) => ({
      pathname: routerState.location.pathname,
      search: routerState.location.search as AppRouteSearch,
    }),
  })
  const routeSnapshot = useMemo(
    () => ({ pathname: snapshot.pathname, search: snapshot.search }),
    [snapshot.pathname, snapshot.search],
  )
  const stateRoute = useMemo(() => getRouteForState(state), [state])
  const routeApplyRef = useRef<string | null>(null)

  useEffect(() => {
    if (routesMatch(routeSnapshot, stateRoute)) return
    const routeKey = JSON.stringify(routeSnapshot)
    if (routeApplyRef.current === routeKey) return
    const action = getRouteAction(routeSnapshot, projects)
    if (!action) return
    routeApplyRef.current = routeKey
    dispatchRouteAction(dispatch, action)
  }, [dispatch, projects, routeSnapshot, stateRoute])

  useEffect(() => {
    if (routesMatch(routeSnapshot, stateRoute)) return
    if (isWaitingForRouteData(routeSnapshot, projects)) return
    routeApplyRef.current = null
    void router.navigate({
      to: stateRoute.pathname,
      search: stateRoute.search,
    })
  }, [projects, routeSnapshot, router, stateRoute])
}
