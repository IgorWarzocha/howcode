import type { DesktopRequestHandlerMap } from "../../../../../shared/desktop-ipc";
import type { PiThreadsModule } from "../../runtime/desktop-runtime-contracts";

type PiPackagesRequestHandlers = Pick<
  DesktopRequestHandlerMap,
  "searchPiPackages" | "getConfiguredPiPackages" | "installPiPackage" | "removePiPackage"
>;

export function createPiPackagesHandlers(piThreads: PiThreadsModule): PiPackagesRequestHandlers {
  return {
    searchPiPackages: (request) => piThreads.searchPiPackages(request),
    getConfiguredPiPackages: (request) => piThreads.listConfiguredPiPackages(request),
    installPiPackage: (request) => piThreads.installPiPackage(request),
    removePiPackage: (request) => piThreads.removePiPackage(request),
  };
}
