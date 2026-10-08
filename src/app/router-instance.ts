import {
  createBrowserHistory,
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { AppShell } from './app-shell'

const history =
  typeof window !== 'undefined' && window.location.protocol === 'file:'
    ? createHashHistory()
    : createBrowserHistory()
const rootRoute = createRootRoute({ component: AppShell })
const appRoutes = [
  '/',
  '/archived',
  '/automations',
  '/chats',
  '/claw',
  '/git',
  '/inbox',
  '/settings',
  '/history',
  '/skills',
  '/work',
  '/workspaces',
].map((path) => createRoute({ getParentRoute: () => rootRoute, path }))

export const router = createRouter({
  history,
  routeTree: rootRoute.addChildren(appRoutes),
  parseSearch: (search) => Object.fromEntries(new URLSearchParams(search)),
  stringifySearch: (search) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(search)) {
      if (typeof value === 'string') params.set(key, value)
    }
    const query = params.toString()
    return query ? `?${query}` : ''
  },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
