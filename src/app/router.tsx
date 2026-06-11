import { createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { AppShell } from './app-shell'

const rootRoute = createRootRoute({ component: AppShell })

const appRoutes = [
  '/',
  '/archived',
  '/automations',
  '/chat',
  '/claw',
  '/code',
  '/extensions',
  '/git',
  '/inbox',
  '/project',
  '/settings',
  '/sessions',
  '/skills',
  '/thread',
  '/work',
].map((path) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path,
  }),
)

const routeTree = rootRoute.addChildren(appRoutes)

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export function AppRouter() {
  return <RouterProvider router={router} />
}
