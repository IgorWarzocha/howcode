import type { ToolkitComponentSettings } from '@howcode/shared/toolkit-components'
import { useRouter, useRouterState } from '@tanstack/react-router'
import { useEffect, useMemo, useRef } from 'react'
import { isWorkspaceViewEnabled } from '../component-system/toolkit-components'
import type { WorkspaceAction, WorkspaceState } from '../state/workspace-model'
import type { Project, View } from '../types'

type NonGitOpsView = Exclude<View, 'gitops'>

type AppRouteSearch = Record<string, unknown>

export type AppRouteSnapshot = {
  pathname: string
  search: AppRouteSearch
}

type AppShellUrlSyncInput = {
  toolkitSettings?: ToolkitComponentSettings | undefined
  dispatch: React.Dispatch<WorkspaceAction>
  loadProjectThreads: (
    projectId: string,
    options?: { chat?: boolean | undefined },
  ) => Promise<unknown>
  projects: Project[]
  shellLoading: boolean
  state: WorkspaceState
  selectedWorkspaceId: string | null
  onSelectWorkspace: (workspaceId: string | null) => void
}

type AppShellUrlSyncCursor = {
  routeKey: string | null
  stateKey: string | null
}

type AppShellUrlSyncDecision =
  | { type: 'defer' }
  | {
      type: 'dispatch-route'
      action: WorkspaceAction | WorkspaceAction[]
      next: AppShellUrlSyncCursor
    }
  | {
      type: 'hydrate-route-scope'
      intent: AppShellUrlSyncCursor
      projectId: string
      scope: 'chat' | 'code'
    }
  | { type: 'navigate-state'; next: AppShellUrlSyncCursor }
  | { type: 'synchronized'; next: AppShellUrlSyncCursor }

const leadingSlashesPattern = /^\/+/

const routeViews = new Set<NonGitOpsView>([
  'archived',
  'automations',
  'chat',
  'claw',
  'code',
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
  return project && thread?.conversationId
    ? { project, thread, conversationId: thread.conversationId }
    : null
}

function getCurrentRoute(snapshot: AppRouteSnapshot) {
  const pathName = snapshot.pathname.replace(leadingSlashesPattern, '') || 'landing'
  const projectId = getStringSearchValue(snapshot.search, 'projectId')
  const threadId = getStringSearchValue(snapshot.search, 'threadId')
  const conversationId = getStringSearchValue(snapshot.search, 'conversationId')
  // Old chat/thread URLs stay readable. New URLs expose one Chat concept while
  // retaining the saved composer capability context, not a second chat class.
  const routeName =
    pathName === 'chats'
      ? getStringSearchValue(snapshot.search, 'composerMode') === 'code'
        ? 'thread'
        : 'chat'
      : pathName === 'workspaces'
        ? projectId
          ? 'project'
          : 'chat'
        : pathName
  return { routeName, projectId, threadId, conversationId }
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

function getRouteForState(
  state: WorkspaceState,
  selectedWorkspaceId: string | null,
): AppRouteSnapshot {
  if (state.activeView === 'landing') return { pathname: '/', search: {} }
  if (state.activeView === 'project') {
    return {
      pathname: '/workspaces',
      search: cleanSearch({
        projectId: state.selectedProjectId,
        workspaceId: selectedWorkspaceId,
      }),
    }
  }
  if (state.activeView === 'thread') {
    return {
      pathname: '/chats',
      search: cleanSearch({
        projectId: state.selectedProjectId,
        threadId: state.selectedThreadId,
        composerMode: 'code',
      }),
    }
  }
  if (state.activeView === 'chat') {
    return {
      pathname: state.selectedThreadId ? '/chats' : '/workspaces',
      search: state.selectedThreadId
        ? cleanSearch({
            projectId: state.selectedProjectId,
            threadId: state.selectedThreadId,
            composerMode: 'chat',
          })
        : cleanSearch({ workspaceId: selectedWorkspaceId }),
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
      search: cleanSearch({ conversationId: state.selectedInboxConversationId }),
    }
  }

  return { pathname: `/${state.activeView}`, search: {} }
}

function getChatRouteAction(
  route: ReturnType<typeof getCurrentRoute>,
  projects: Project[],
  view: 'chat' | 'thread',
): WorkspaceAction | WorkspaceAction[] | null {
  if (view === 'chat' && !route.threadId) {
    return [{ type: 'show-view', view: 'chat' }, { type: 'clear-thread-selection' }]
  }
  const thread = findThread(projects, route.projectId, route.threadId)
  return thread
    ? {
        type: 'open-thread',
        projectId: thread.project.id,
        threadId: thread.thread.id,
        conversationId: thread.conversationId,
        view,
      }
    : null
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
    return getChatRouteAction(route, projects, route.routeName)
  }
  if (route.routeName === 'git') {
    const thread = findThread(projects, route.projectId, route.threadId)
    return thread
      ? [
          {
            type: 'open-thread',
            projectId: thread.project.id,
            threadId: thread.thread.id,
            conversationId: thread.conversationId,
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
      { type: 'select-inbox-thread', conversationId: route.conversationId },
    ]
  }
  if (isRouteView(route.routeName)) {
    return { type: 'show-view', view: route.routeName }
  }
  return { type: 'show-landing' }
}

function getRouteDataWait(snapshot: AppRouteSnapshot, projects: Project[], shellLoading: boolean) {
  const route = getCurrentRoute(snapshot)
  if (!(route.routeName === 'thread' || route.routeName === 'chat' || route.routeName === 'git')) {
    return null
  }
  if (!(route.projectId && route.threadId)) {
    return null
  }

  if (findThread(projects, route.projectId, route.threadId)) return null
  if (shellLoading) return { type: 'shell' } as const

  const project = projects.find((candidate) => candidate.id === route.projectId)
  if (!project) return null

  const relevantScope = route.routeName === 'chat' ? 'chat' : 'code'
  if (project.threadsLoaded === true && project.threadsScope === relevantScope) return null
  return { type: 'scope', projectId: project.id, scope: relevantScope } as const
}

function dispatchRouteAction(
  dispatch: React.Dispatch<WorkspaceAction>,
  action: WorkspaceAction | WorkspaceAction[],
  snapshot: AppRouteSnapshot,
  onSelectWorkspace: (workspaceId: string | null) => void,
) {
  if (snapshot.pathname === '/workspaces') {
    onSelectWorkspace(getStringSearchValue(snapshot.search, 'workspaceId'))
  }
  for (const item of Array.isArray(action) ? action : [action]) {
    dispatch(item)
  }
}

function getRouteKey(snapshot: AppRouteSnapshot) {
  return JSON.stringify(snapshot)
}

function getRouteDataDecision(
  routeSnapshot: AppRouteSnapshot,
  projects: Project[],
  shellLoading: boolean,
  intent: AppShellUrlSyncCursor,
) {
  const routeDataWait = getRouteDataWait(routeSnapshot, projects, shellLoading)
  if (!routeDataWait) return null
  if (routeDataWait.type === 'shell') return { type: 'defer' } as const
  return {
    type: 'hydrate-route-scope',
    intent,
    projectId: routeDataWait.projectId,
    scope: routeDataWait.scope,
  } as const
}

export function getAppShellUrlSyncDecision(input: {
  previous: AppShellUrlSyncCursor
  projects: Project[]
  routeHydration: AppShellUrlSyncCursor | null
  routeSnapshot: AppRouteSnapshot
  shellLoading: boolean
  stateRoute: AppRouteSnapshot
}): AppShellUrlSyncDecision {
  const routeKey = getRouteKey(input.routeSnapshot)
  const stateKey = getRouteKey(input.stateRoute)
  const routeChanged = input.previous.routeKey !== routeKey
  const stateChanged = input.previous.stateKey !== stateKey

  if (routesMatch(input.routeSnapshot, input.stateRoute)) {
    return { type: 'synchronized', next: { routeKey, stateKey } }
  }
  if (input.routeHydration?.routeKey === routeKey && input.routeHydration.stateKey !== stateKey) {
    return { type: 'navigate-state', next: { routeKey, stateKey } }
  }

  if (routeChanged && (input.previous.routeKey === null || !stateChanged)) {
    const routeDataDecision = getRouteDataDecision(
      input.routeSnapshot,
      input.projects,
      input.shellLoading,
      { routeKey, stateKey },
    )
    if (routeDataDecision) return routeDataDecision
    const action = getRouteAction(input.routeSnapshot, input.projects)
    if (action) {
      return {
        type: 'dispatch-route',
        action,
        next: { routeKey, stateKey: input.previous.stateKey },
      }
    }
    return { type: 'navigate-state', next: { routeKey, stateKey } }
  }

  if (!stateChanged) return { type: 'defer' }
  if (routeChanged) {
    const routeDataDecision = getRouteDataDecision(
      input.routeSnapshot,
      input.projects,
      input.shellLoading,
      { routeKey, stateKey },
    )
    if (routeDataDecision) return routeDataDecision
  }

  return { type: 'navigate-state', next: { routeKey, stateKey } }
}

export function useAppShellUrlSync({
  toolkitSettings,
  dispatch,
  loadProjectThreads,
  projects,
  shellLoading,
  state,
  selectedWorkspaceId,
  onSelectWorkspace,
}: AppShellUrlSyncInput) {
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
  const stateRoute = useMemo(
    () => getRouteForState(state, selectedWorkspaceId),
    [state, selectedWorkspaceId],
  )
  const syncRef = useRef<AppShellUrlSyncCursor>({
    routeKey: null,
    stateKey: null,
  })
  const routeHydrationRef = useRef<AppShellUrlSyncCursor | null>(null)

  useEffect(() => {
    if (shellLoading) return
    const routeView = getCurrentRoute(routeSnapshot).routeName
    if (
      !(
        isWorkspaceViewEnabled(toolkitSettings, routeView as View) &&
        (syncRef.current.routeKey === null ||
          isWorkspaceViewEnabled(toolkitSettings, state.activeView))
      )
    ) {
      routeHydrationRef.current = null
      dispatch({ type: 'show-view', view: 'chat' })
      const fallbackRoute: AppRouteSnapshot = { pathname: '/chat', search: {} }
      void router.navigate({ to: fallbackRoute.pathname, search: fallbackRoute.search })
      return
    }
    const decision = getAppShellUrlSyncDecision({
      previous: syncRef.current,
      projects,
      routeHydration: routeHydrationRef.current,
      routeSnapshot,
      shellLoading,
      stateRoute,
    })
    if (decision.type === 'defer') return
    if (decision.type === 'hydrate-route-scope') {
      let cancelled = false
      routeHydrationRef.current = decision.intent
      void loadProjectThreads(decision.projectId, { chat: decision.scope === 'chat' }).catch(() => {
        if (cancelled || routeHydrationRef.current !== decision.intent) return
        routeHydrationRef.current = null
        syncRef.current = decision.intent
        void router.navigate({
          to: stateRoute.pathname,
          search: stateRoute.search,
        })
      })
      return () => {
        cancelled = true
      }
    }

    routeHydrationRef.current = null
    syncRef.current = decision.next
    if (decision.type === 'synchronized') return
    if (decision.type === 'dispatch-route') {
      dispatchRouteAction(dispatch, decision.action, routeSnapshot, onSelectWorkspace)
      return
    }
    void router.navigate({
      to: stateRoute.pathname,
      search: stateRoute.search,
    })
  }, [
    dispatch,
    loadProjectThreads,
    projects,
    routeSnapshot,
    router,
    shellLoading,
    stateRoute,
    toolkitSettings,
    state.activeView,
    onSelectWorkspace,
  ])
}
