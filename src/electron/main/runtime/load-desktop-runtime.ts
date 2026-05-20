import type { DesktopServiceRuntime } from '../../../../shared/desktop-service-contracts'
import { createDesktopServiceRuntime } from './desktop-service-proxy'

export async function loadDesktopServiceRuntime(): Promise<DesktopServiceRuntime> {
  return createDesktopServiceRuntime()
}
