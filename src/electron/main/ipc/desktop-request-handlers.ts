import type { DesktopServiceRuntime } from '../../../../shared/desktop-service-contracts'
import { createDesktopRequestHandlers as createHostDesktopRequestHandlers } from '../../../desktop-host/desktop-requests/handlers'
import type { AppUpdater } from '../updater/app-updater'
import { createAppUpdateHandlers } from './request-handlers/app-update'
import { createSystemHandlers } from './request-handlers/system'

export function createDesktopRequestHandlers(
  runtime: DesktopServiceRuntime,
  appUpdater: AppUpdater,
  onSettingsChanged?: (() => Promise<void> | void) | undefined,
) {
  return createHostDesktopRequestHandlers({
    runtime,
    onSettingsChanged,
    platform: {
      ...createAppUpdateHandlers(appUpdater),
      ...createSystemHandlers(),
    },
  })
}
