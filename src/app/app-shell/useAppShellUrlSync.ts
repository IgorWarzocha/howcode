import type { WorkspaceNavigationState } from '@howcode/shared/desktop-workspace-contracts'
import {
  isToolkitComponentEnabled,
  type ToolkitComponentSettings,
} from '@howcode/shared/toolkit-components'
import { useRouter, useRouterState } from '@tanstack/react-router'
import { useEffect, useMemo, useRef } from 'react'
import {
  useInstalledComponentReadiness,
  useInstalledRendererContributions,
} from '../component-system/installed-component-catalog'
import { isWorkspaceViewEnabled } from '../component-system/toolkit-components'
import type { WorkspaceAction, WorkspaceState } from '../state/workspace-model'
import type { View, WorkingDirectory } from '../types'
import {
  type AppRouteSnapshot,
  getRouteAction,
  getRouteForState,
  normalizeAppRoute,
} from './app-routes'

export type { AppRouteSnapshot } from './app-routes'

type Cursor = { routeKey: string | null; stateKey: string | null }
type Decision =
  | { type: 'defer' }
  | { type: 'dispatch-route'; action: WorkspaceAction | WorkspaceAction[]; next: Cursor }
  | { type: 'navigate-state' | 'synchronized'; next: Cursor }

export function getAppShellUrlSyncDecision(input: {
  previous: Cursor
  navigation: WorkspaceNavigationState | null
  directories: WorkingDirectory[]
  routeSnapshot: AppRouteSnapshot
  loading: boolean
  stateRoute: AppRouteSnapshot
}): Decision {
  const routeKey = JSON.stringify(input.routeSnapshot)
  const stateKey = JSON.stringify(input.stateRoute)
  const next = { routeKey, stateKey }
  if (routeKey === stateKey) return { type: 'synchronized', next }
  const routeChanged = input.previous.routeKey !== routeKey
  const stateChanged = input.previous.stateKey !== stateKey
  if (routeChanged && (input.previous.routeKey === null || !stateChanged)) {
    if (input.loading) return { type: 'defer' }
    const action = getRouteAction(input.routeSnapshot, input.navigation)
    return action
      ? { type: 'dispatch-route', action, next: { routeKey, stateKey: input.previous.stateKey } }
      : { type: 'navigate-state', next }
  }
  return stateChanged ? { type: 'navigate-state', next } : { type: 'defer' }
}

export function useAppShellUrlSync(input: {
  toolkitSettings?: ToolkitComponentSettings | undefined
  dispatch: React.Dispatch<WorkspaceAction>
  directories: WorkingDirectory[]
  navigation: WorkspaceNavigationState | null
  loading: boolean
  state: WorkspaceState
}) {
  const router = useRouter()
  const componentLoading = useInstalledComponentReadiness()
  const contributions = useInstalledRendererContributions()
  const activeViewEnabled = useMemo(
    () => isWorkspaceViewEnabled(input.toolkitSettings, input.state.activeView, contributions),
    [contributions, input.toolkitSettings, input.state.activeView],
  )
  const snapshot = useRouterState({
    select: (routerState) => ({
      pathname: routerState.location.pathname,
      search: routerState.location.search as AppRouteSnapshot['search'],
    }),
  })
  const stateRoute = useMemo(
    () => getRouteForState(input.state, input.navigation, input.directories),
    [input.state, input.navigation, input.directories],
  )
  const cursor = useRef<Cursor>({ routeKey: null, stateKey: null })

  useEffect(() => {
    if (!(input.loading || componentLoading || activeViewEnabled)) {
      input.dispatch(unavailablePageAction(input.state.utilityViewReturnState))
      return
    }
    const decision = getAppShellUrlSyncDecision({
      previous: cursor.current,
      routeSnapshot: snapshot,
      stateRoute,
      navigation: input.navigation,
      directories: input.directories,
      loading: input.loading || componentLoading,
    })
    if (decision.type === 'defer') return
    cursor.current = decision.next
    if (decision.type === 'synchronized') return
    if (decision.type === 'dispatch-route') {
      const enabled = isRouteEnabled(snapshot, input.toolkitSettings)
      if (!enabled) {
        input.dispatch({ type: 'select-workspace', workspaceId: null })
        const fallback: AppRouteSnapshot = { pathname: '/workspaces', search: {} }
        void router.navigate({ to: fallback.pathname, search: fallback.search, replace: true })
        return
      }
      dispatchRouteActions(input.dispatch, decision.action)
      return
    }
    void router.navigate({
      to: stateRoute.pathname,
      search: stateRoute.search,
      replace:
        JSON.stringify(getRouteAction(snapshot, input.navigation)) ===
        JSON.stringify(getRouteAction(stateRoute, input.navigation)),
    })
  }, [
    componentLoading,
    activeViewEnabled,
    input.state.utilityViewReturnState,
    input.directories,
    input.dispatch,
    input.loading,
    input.navigation,
    input.toolkitSettings,
    router,
    snapshot,
    stateRoute,
  ])
}

function dispatchRouteActions(
  dispatch: React.Dispatch<WorkspaceAction>,
  action: WorkspaceAction | WorkspaceAction[],
) {
  for (const item of Array.isArray(action) ? action : [action]) dispatch(item)
}

function isRouteEnabled(
  snapshot: AppRouteSnapshot,
  settings: ToolkitComponentSettings | undefined,
) {
  const routeView = normalizeAppRoute(snapshot).routeName
  return routeView === 'git'
    ? isToolkitComponentEnabled(settings, 'coding')
    : isWorkspaceViewEnabled(settings, routeView as View)
}

function unavailablePageAction(
  returnState: WorkspaceState['utilityViewReturnState'],
): WorkspaceAction {
  return returnState ? { type: 'close-utility-view' } : { type: 'show-view', view: 'chat' }
}
