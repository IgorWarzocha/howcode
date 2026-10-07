import type { DesktopRequestHandlerMap } from '../../../shared/desktop-ipc'
import type { PackageUiService } from '../../../shared/package-ui-contracts'

export function createPackageUiHandlers(
  service: PackageUiService,
): Pick<DesktopRequestHandlerMap, 'listPackageUis' | 'loadPackageUi' | 'invokePackageUiRpc'> {
  return {
    listPackageUis: () => service.listPackageUis(),
    loadPackageUi: (reference) => service.loadPackageUi(reference),
    invokePackageUiRpc: (request) => service.invokePackageUiRpc(request),
  }
}
