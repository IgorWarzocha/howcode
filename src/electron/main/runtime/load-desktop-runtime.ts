import type { DesktopRuntimeModules } from './desktop-runtime-contracts'
import { createDesktopServiceRuntime } from './desktop-service-proxy'

export async function loadDesktopRuntimeModules(): Promise<DesktopRuntimeModules> {
  return createDesktopServiceRuntime()
}
