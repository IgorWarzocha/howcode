import type { DesktopRequestHandlerMap } from '../../../../../shared/desktop-ipc'
import type { AppUpdater } from '../../updater/app-updater'

type AppUpdateRequestHandlers = Pick<
  DesktopRequestHandlerMap,
  'getAppUpdateState' | 'checkAppUpdate' | 'installAppUpdate' | 'restartAppUpdate'
>

export function createAppUpdateHandlers(appUpdater: AppUpdater): AppUpdateRequestHandlers {
  return {
    getAppUpdateState: () => appUpdater.getState(),
    checkAppUpdate: () => appUpdater.checkForUpdate(),
    installAppUpdate: () => appUpdater.installUpdate(),
    restartAppUpdate: () => appUpdater.restartToUpdate(),
  }
}
