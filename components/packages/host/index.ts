import type { DesktopRequestHandlerMap } from '../../../shared/desktop-ipc'
import type { PackageUiService } from '../../../shared/package-ui-contracts'

export function createPackageUiHandlers(
  service: PackageUiService,
): Pick<
  DesktopRequestHandlerMap,
  | 'listPackageUis'
  | 'listInstalledComponents'
  | 'admitInstalledComponent'
  | 'loadInstalledComponent'
  | 'loadPackageUi'
  | 'openPackageUiBinding'
  | 'readPackageUiBindingEvents'
  | 'operatePackageUiBinding'
  | 'closePackageUiBinding'
> {
  return {
    listInstalledComponents: () => service.listInstalledComponents(),
    admitInstalledComponent: (request) => service.admitInstalledComponent(request),
    loadInstalledComponent: (reference) => service.loadInstalledComponent(reference),
    listPackageUis: () => service.listPackageUis(),
    loadPackageUi: (reference) => service.loadPackageUi(reference),
    openPackageUiBinding: (request) => service.openPackageUiBinding(request),
    readPackageUiBindingEvents: (request) => service.readPackageUiBindingEvents(request),
    operatePackageUiBinding: (request) => service.operatePackageUiBinding(request),
    closePackageUiBinding: (request) => service.closePackageUiBinding(request),
  }
}
