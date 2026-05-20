import type { DesktopServiceRuntime } from './desktop-runtime-contracts'
import { createDesktopServiceRuntime } from './desktop-service-proxy'

export async function loadDesktopServiceRuntime(): Promise<DesktopServiceRuntime> {
  return createDesktopServiceRuntime()
}
