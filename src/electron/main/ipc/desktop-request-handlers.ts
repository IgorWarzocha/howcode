import type { DesktopRequestHandlerMap } from '../../../../shared/desktop-ipc'
import type { DesktopServiceRuntime } from '../../../../shared/desktop-service-contracts'
import type { AppUpdater } from '../updater/app-updater'
import { createAppUpdateHandlers } from './request-handlers/app-update'
import { createPiPackagesHandlers } from './request-handlers/pi-packages'
import { createPiSkillsHandlers } from './request-handlers/pi-skills'
import { createPiThreadsHandlers } from './request-handlers/pi-threads'
import { createSystemHandlers } from './request-handlers/system'
import { createTerminalHandlers } from './request-handlers/terminal'

export function createDesktopRequestHandlers(
  runtime: DesktopServiceRuntime,
  appUpdater: AppUpdater,
  onSettingsChanged?: (() => Promise<void> | void) | undefined,
): DesktopRequestHandlerMap {
  return {
    ...createAppUpdateHandlers(appUpdater),
    ...createPiThreadsHandlers(runtime.piThreads, onSettingsChanged),
    ...createPiPackagesHandlers(runtime.piThreads),
    ...createPiSkillsHandlers(runtime.piSkills),
    ...createTerminalHandlers(runtime.terminalManager),
    ...createSystemHandlers(),
  }
}
