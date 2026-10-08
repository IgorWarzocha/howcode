import { Debouncer } from '@tanstack/react-pacer'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo } from 'react'
import type { ShellState } from '../desktop/types'
import { desktopQueryKeys, getShellStateQuery } from '../query/desktop-query'
import type { WorkingDirectory } from '../types'

function sameDirectoryWorktree(
  left: WorkingDirectory['worktree'],
  right: WorkingDirectory['worktree'],
) {
  if (left === right) return true
  if (!(left && right)) return false
  return (
    left.rootDirectoryId === right.rootDirectoryId &&
    left.branchName === right.branchName &&
    left.parentBranchName === right.parentBranchName &&
    left.isMain === right.isMain &&
    left.source === right.source &&
    left.completed === right.completed
  )
}

function sameDirectoryForShellRefresh(left: WorkingDirectory, right: WorkingDirectory) {
  return (
    left.id === right.id &&
    left.resolvedId === right.resolvedId &&
    left.name === right.name &&
    left.chats === right.chats &&
    left.latestModifiedMs === right.latestModifiedMs &&
    left.pinned === right.pinned &&
    left.collapsed === right.collapsed &&
    left.chatsLoaded === right.chatsLoaded &&
    left.chatCount === right.chatCount &&
    left.repoOriginUrl === right.repoOriginUrl &&
    left.repoOriginChecked === right.repoOriginChecked &&
    left.worktreeDirectory === right.worktreeDirectory &&
    sameDirectoryWorktree(left.worktree, right.worktree)
  )
}

function preserveDirectoryReference(
  currentDirectory: WorkingDirectory | undefined,
  nextDirectory: WorkingDirectory,
) {
  return currentDirectory && sameDirectoryForShellRefresh(currentDirectory, nextDirectory)
    ? currentDirectory
    : nextDirectory
}

export function mergeShellStateDirectories(
  currentState: ShellState | null | undefined,
  nextState: ShellState | null,
): ShellState | null {
  if (!nextState) return null
  if (!currentState) return nextState

  const currentDirectoriesById = new Map(
    currentState.directories.map((directory) => [directory.id, directory] as const),
  )
  let reusedDirectoryCount = 0
  const directories = nextState.directories.map((directory) => {
    const currentDirectory = currentDirectoriesById.get(directory.id)
    if (!currentDirectory?.chatsLoaded || directory.chatsLoaded) {
      const nextDirectory = preserveDirectoryReference(currentDirectory, directory)
      if (nextDirectory === currentDirectory) reusedDirectoryCount += 1
      return nextDirectory
    }
    const nextDirectory = preserveDirectoryReference(currentDirectory, {
      ...directory,
      chats: currentDirectory.chats,
      chatCount: Math.max(directory.chatCount ?? 0, currentDirectory.chats.length),
      latestModifiedMs: Math.max(
        directory.latestModifiedMs ?? 0,
        currentDirectory.latestModifiedMs ?? 0,
      ),
      chatsLoaded: true,
    })
    if (nextDirectory === currentDirectory) reusedDirectoryCount += 1
    return nextDirectory
  })
  return {
    ...nextState,
    directories:
      reusedDirectoryCount === directories.length ? currentState.directories : directories,
  }
}

export function useDesktopShellStateQuery() {
  const queryClient = useQueryClient()
  const loadMergedShellState = useCallback(async () => {
    const nextState = await getShellStateQuery()
    const currentState = queryClient.getQueryData<ShellState | null>(desktopQueryKeys.shellState())
    return mergeShellStateDirectories(currentState, nextState)
  }, [queryClient])
  const shellStateQuery = useQuery<ShellState | null>({
    queryKey: desktopQueryKeys.shellState(),
    queryFn: loadMergedShellState,
    staleTime: Number.POSITIVE_INFINITY,
  })
  const shellRefreshDebouncer = useMemo(
    () =>
      new Debouncer(
        () => {
          void queryClient.invalidateQueries({ queryKey: desktopQueryKeys.shellState() })
        },
        { wait: 140 },
      ),
    [queryClient],
  )
  const refreshShellState = useCallback(
    () =>
      queryClient.fetchQuery({
        queryKey: desktopQueryKeys.shellState(),
        queryFn: loadMergedShellState,
        staleTime: 0,
      }),
    [loadMergedShellState, queryClient],
  )
  const scheduleShellStateRefresh = useCallback(() => {
    shellRefreshDebouncer.maybeExecute()
  }, [shellRefreshDebouncer])
  useEffect(() => () => shellRefreshDebouncer.cancel(), [shellRefreshDebouncer])
  return { refreshShellState, scheduleShellStateRefresh, shellStateQuery }
}
