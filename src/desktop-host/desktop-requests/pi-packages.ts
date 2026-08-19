import type { DesktopRequestHandlerMap } from '../../../shared/desktop-ipc'
import type { PiThreadsService } from '../../../shared/desktop-service-contracts'

type PiPackagesRequestHandlers = Pick<
  DesktopRequestHandlerMap,
  'searchPiPackages' | 'getConfiguredPiPackages' | 'installPiPackage' | 'removePiPackage'
>

export function createPiPackagesHandlers(piThreads: PiThreadsService): PiPackagesRequestHandlers {
  return {
    searchPiPackages: (request) => piThreads.searchPiPackages(request),
    getConfiguredPiPackages: (request) => piThreads.listConfiguredPiPackages(request),
    installPiPackage: (request) => piThreads.installPiPackage(request),
    removePiPackage: (request) => piThreads.removePiPackage(request),
  }
}
