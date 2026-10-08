import type { ShellState } from '../../../../src/app/desktop/types'
import { desktopQueryKeys } from '../../../../src/app/query/desktop-query'
import type { WorkingDirectory } from '../../../../src/app/types'

type QueryClientLike = {
  setQueryData: (queryKey: readonly unknown[], updater: (current: unknown) => unknown) => void
}

type DirectoryPatch = Partial<Omit<WorkingDirectory, 'id'>> & { id: string }

const pathSeparatorPattern = /[\\/]/

function getDirectoryName(directoryId: string) {
  return directoryId.split(pathSeparatorPattern).filter(Boolean).at(-1) || directoryId
}

function createDirectoryFallback(
  directoryId: string,
  name = getDirectoryName(directoryId),
): WorkingDirectory {
  return {
    id: directoryId,
    name,
    chats: [],
    latestModifiedMs: 0,
    pinned: false,
    collapsed: false,
    chatCount: 0,
    chatsLoaded: false,
  }
}

function createPatchedDirectoryFallback(directory: DirectoryPatch): WorkingDirectory {
  return sameDirectoryReferenceOrPatch(
    createDirectoryFallback(directory.id, directory.name),
    directory,
  )
}

function patchDirectories(
  queryClient: QueryClientLike,
  patcher: (directories: WorkingDirectory[], state: ShellState) => WorkingDirectory[],
) {
  queryClient.setQueryData(desktopQueryKeys.shellState(), (current) => {
    const currentState = current as ShellState | null | undefined
    if (!currentState) return currentState ?? null
    const directories = patcher(currentState.directories, currentState)
    return directories === currentState.directories
      ? currentState
      : { ...currentState, directories }
  })
}

function sameDirectoryReferenceOrPatch(directory: WorkingDirectory, patch: DirectoryPatch) {
  const changed = Object.entries(patch).some(
    ([key, value]) => key !== 'id' && Reflect.get(directory, key) !== value,
  )
  return changed ? { ...directory, ...patch } : directory
}

export function upsertShellDirectory(
  queryClient: QueryClientLike,
  directory: DirectoryPatch,
  options: { reveal?: boolean } = {},
) {
  patchDirectories(queryClient, (directories) => {
    const index = directories.findIndex((candidate) => candidate.id === directory.id)
    const patch = options.reveal ? { ...directory, collapsed: false } : directory
    if (index === -1) return [createPatchedDirectoryFallback(patch), ...directories]
    const existingDirectory = directories[index]
    if (!existingDirectory) return directories
    const nextDirectory = sameDirectoryReferenceOrPatch(existingDirectory, patch)
    if (nextDirectory === existingDirectory) return directories
    return directories.map((candidate, candidateIndex) =>
      candidateIndex === index ? nextDirectory : candidate,
    )
  })
}

export function updateShellDirectory(
  queryClient: QueryClientLike,
  directoryId: string,
  updater: (directory: WorkingDirectory) => WorkingDirectory,
) {
  patchDirectories(queryClient, (directories) => {
    let changed = false
    const nextDirectories = directories.map((directory) => {
      if (directory.id !== directoryId) return directory
      const nextDirectory = updater(directory)
      changed = changed || nextDirectory !== directory
      return nextDirectory
    })
    return changed ? nextDirectories : directories
  })
}

export function removeShellDirectoryFamily(queryClient: QueryClientLike, directoryId: string) {
  patchDirectories(queryClient, (directories) => {
    const nextDirectories = directories.filter(
      (directory) =>
        directory.id !== directoryId && directory.worktree?.rootDirectoryId !== directoryId,
    )
    return nextDirectories.length === directories.length ? directories : nextDirectories
  })
}

export function upsertShellWorktreeDirectory(
  queryClient: QueryClientLike,
  input: {
    rootDirectoryId: string
    worktreeDirectoryId: string
    branchName: string | null
    parentBranchName?: string | null | undefined
  },
) {
  upsertShellDirectory(queryClient, {
    id: input.rootDirectoryId,
    worktree: {
      rootDirectoryId: input.rootDirectoryId,
      branchName: null,
      isMain: true,
      source: 'howcode',
    },
  })
  upsertShellDirectory(queryClient, {
    id: input.worktreeDirectoryId,
    name: getDirectoryName(input.worktreeDirectoryId),
    chatsLoaded: true,
    worktree: {
      rootDirectoryId: input.rootDirectoryId,
      branchName: input.branchName,
      parentBranchName: input.parentBranchName ?? null,
      isMain: false,
      source: 'howcode',
      completed: false,
    },
  })
}

export function removeShellWorktreeDirectory(
  queryClient: QueryClientLike,
  worktreeDirectoryId: string,
) {
  patchDirectories(queryClient, (directories) => {
    const nextDirectories = directories.filter((directory) => directory.id !== worktreeDirectoryId)
    return nextDirectories.length === directories.length ? directories : nextDirectories
  })
}

export function setShellWorktreeCompleted(
  queryClient: QueryClientLike,
  worktreeDirectoryId: string,
  completed: boolean,
) {
  updateShellDirectory(queryClient, worktreeDirectoryId, (directory) => {
    if (!directory.worktree || directory.worktree.completed === completed) return directory
    return { ...directory, worktree: { ...directory.worktree, completed } }
  })
}

export function setShellWorktreeDirectory(
  queryClient: QueryClientLike,
  rootDirectoryId: string,
  worktreeDirectory: string,
) {
  updateShellDirectory(queryClient, rootDirectoryId, (directory) =>
    directory.worktreeDirectory === worktreeDirectory
      ? directory
      : { ...directory, worktreeDirectory },
  )
}

export function setShellSidebarVisibleDirectoryIds(
  queryClient: QueryClientLike,
  directoryIds: string[],
) {
  queryClient.setQueryData(desktopQueryKeys.shellState(), (current) => {
    const currentState = current as ShellState | null | undefined
    if (!currentState) return currentState ?? null
    if (
      currentState.sidebarVisibleDirectoryIds?.length === directoryIds.length &&
      currentState.sidebarVisibleDirectoryIds.every(
        (directoryId, index) => directoryId === directoryIds[index],
      )
    ) {
      return currentState
    }
    return { ...currentState, sidebarVisibleDirectoryIds: directoryIds }
  })
}
