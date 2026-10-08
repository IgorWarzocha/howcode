import type { DesktopRequestHandlerMap } from '../../../shared/desktop-ipc'
import type { WorkingDirectoriesService } from '../../../shared/desktop-service-contracts'
export function createWorkingDirectoriesHandlers(
  directories: WorkingDirectoriesService,
  listDirectoryDirectoryEntries: DesktopRequestHandlerMap['listDirectoryDirectoryEntries'],
) {
  return {
    listDirectoryDirectoryEntries,
    getDirectoryUsageSummary: ({ directoryId }) =>
      directories.loadDirectoryUsageSummary(directoryId),
    getDirectoryFavicon: ({ directoryId }) => directories.loadDirectoryFavicon(directoryId),
  } satisfies Partial<DesktopRequestHandlerMap>
}
