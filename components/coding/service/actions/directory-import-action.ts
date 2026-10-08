import type { DesktopActionResultData } from '../../../../shared/desktop-contracts'
import {
  type DirectoryImportRefreshMode,
  getDirectoryImportRefreshError,
} from './directory-import-refresh'

export type DirectoryImportRefreshOptions = {
  emitRefreshEvent?: boolean | undefined
  force?: boolean | undefined
}

export async function resolveDirectoryImportActionResult<T extends DesktopActionResultData>({
  cwd,
  mode,
  directoryIds,
  refreshOptions,
  refreshShellIndex,
  runAfterRefresh,
}: {
  cwd: string
  mode: DirectoryImportRefreshMode
  directoryIds: string[]
  refreshOptions?: DirectoryImportRefreshOptions
  refreshShellIndex: (cwd: string, options?: DirectoryImportRefreshOptions) => Promise<boolean>
  runAfterRefresh: (directoryIds: string[]) => Promise<T>
}) {
  const refreshed = await refreshShellIndex(cwd, refreshOptions)
  const refreshError = getDirectoryImportRefreshError({
    mode,
    directoryIds,
    refreshed,
  })

  if (refreshError) {
    return {
      error: refreshError,
    } satisfies DesktopActionResultData
  }

  return await runAfterRefresh(directoryIds)
}
