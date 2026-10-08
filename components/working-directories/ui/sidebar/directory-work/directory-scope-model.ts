import type { WorkingDirectory } from '../../../../../src/app/types'

export function getDirectoryScopeLabel({
  selectedDirectory,
  visibleDirectories,
}: {
  selectedDirectory: WorkingDirectory | null
  visibleDirectories: readonly WorkingDirectory[]
}) {
  if (visibleDirectories.length === 0) return 'No workspaces selected'
  const primaryVisibleDirectory =
    visibleDirectories.find((directory) => directory.id === selectedDirectory?.id) ??
    visibleDirectories[0]
  const primaryDirectoryName =
    primaryVisibleDirectory?.name ?? selectedDirectory?.name ?? 'Workspaces'
  return visibleDirectories.length > 1
    ? `${primaryDirectoryName} +${visibleDirectories.length - 1}`
    : primaryDirectoryName
}

export function getDisplayableDirectories(directories: readonly WorkingDirectory[]) {
  return directories.filter(
    (directory) =>
      directory.id.trim().length > 0 &&
      directory.name.trim().length > 0 &&
      directory.worktree?.isMain !== false,
  )
}

export function getDisplayableWorkspaces(directories: readonly WorkingDirectory[]) {
  return directories.filter(
    (directory) => directory.id.trim().length > 0 && directory.name.trim().length > 0,
  )
}

export function getSelectedDirectoryForScope({
  directories,
  selectedDirectoryId,
  workspaces,
}: {
  directories: readonly WorkingDirectory[]
  selectedDirectoryId: string
  workspaces: readonly WorkingDirectory[]
}) {
  const selectedWorkspace = workspaces.find((directory) => directory.id === selectedDirectoryId)
  return (
    directories.find((directory) => directory.id === selectedDirectoryId) ??
    directories.find(
      (directory) => directory.id === selectedWorkspace?.worktree?.rootDirectoryId,
    ) ??
    directories[0] ??
    null
  )
}

export function filterVisibleDirectoryIds(
  configuredDirectoryIds: string[] | null | undefined,
  directories: readonly WorkingDirectory[],
) {
  if (!configuredDirectoryIds) return configuredDirectoryIds
  const validDirectoryIds = new Set(directories.map((directory) => directory.id))
  return configuredDirectoryIds.filter((directoryId) => validDirectoryIds.has(directoryId))
}

export function toggleVisibleDirectoryId(
  directoryId: string,
  visibleDirectoryIds: readonly string[],
) {
  const wasVisible = visibleDirectoryIds.includes(directoryId)
  const nextDirectoryIds = wasVisible
    ? visibleDirectoryIds.filter((id) => id !== directoryId)
    : [...visibleDirectoryIds, directoryId]
  return {
    nextDirectoryIds,
    shouldFocusDirectory: !wasVisible && visibleDirectoryIds.length === 0,
    shouldShowLanding: nextDirectoryIds.length === 0,
  }
}

export function orderDirectoriesForScopeSelector(
  directories: readonly WorkingDirectory[],
  visibleDirectoryIds: string[],
) {
  const visibleIndexById = new Map(
    visibleDirectoryIds.map((directoryId, index) => [directoryId, index]),
  )
  return directories.toSorted((left, right) => {
    const leftIndex = visibleIndexById.get(left.id)
    const rightIndex = visibleIndexById.get(right.id)
    if (leftIndex !== undefined && rightIndex !== undefined) return leftIndex - rightIndex
    if (leftIndex !== undefined) return -1
    if (rightIndex !== undefined) return 1
    return 0
  })
}

export function getVisibleDirectoryIds(
  storedVisibleDirectoryIds: string[] | null,
  initialVisibleDirectoryIds: string[] | null | undefined,
  selectedDirectory: WorkingDirectory | null,
) {
  if (storedVisibleDirectoryIds) return storedVisibleDirectoryIds
  if (initialVisibleDirectoryIds) return initialVisibleDirectoryIds
  if (storedVisibleDirectoryIds === null && initialVisibleDirectoryIds === null) {
    return selectedDirectory ? [selectedDirectory.id] : []
  }
  return []
}
