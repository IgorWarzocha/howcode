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
  '/chat',
  '/chats',
  '/claw',
  '/code',
  '/git',
  '/inbox',
  '/project',
  '/settings',
  '/sessions',
  '/skills',
  '/thread',
  '/work',
  '/workspaces',
].map((path) => createRoute({ getParentRoute: () => rootRoute, path }))

export const router = createRouter({ history, routeTree: rootRoute.addChildren(appRoutes) })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
