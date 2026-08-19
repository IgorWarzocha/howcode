import { RouterProvider } from '@tanstack/react-router'
import { router } from './router-instance'

export function AppRouter() {
  return <RouterProvider router={router} />
}
