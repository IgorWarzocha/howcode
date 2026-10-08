export type DirectoryImportRefreshMode = 'scan' | 'import'

export function getDirectoryImportRefreshError({
  mode,
  directoryIds,
  refreshed,
}: {
  mode: DirectoryImportRefreshMode
  directoryIds: string[]
  refreshed: boolean
}) {
  if (refreshed || directoryIds.length > 0) {
    return null
  }

  return mode === 'scan'
    ? 'Could not refresh Pi sessions before scanning projects.'
    : 'Could not refresh Pi sessions before importing projects.'
}
