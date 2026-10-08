import { useEffect, useEffectEvent } from 'react'
import type { WorkingDirectory } from '../../../../../src/app/types'
import { getWorktreeDirectoriesForRoot } from './directory-chat-model'

export function useDirectoryChatLoading({
  allWorkspaces,
  visibleDirectories,
  onLoadDirectoryChats,
}: {
  allWorkspaces: readonly WorkingDirectory[]
  visibleDirectories: readonly WorkingDirectory[]
  onLoadDirectoryChats: (directoryId: string) => Promise<unknown>
}) {
  const loadDirectoryChats = useEffectEvent(onLoadDirectoryChats)

  useEffect(() => {
    const directoriesToLoad = new Map(
      visibleDirectories.map((directory) => [directory.id, directory]),
    )
    for (const directory of visibleDirectories) {
      for (const worktreeDirectory of getWorktreeDirectoriesForRoot(directory, allWorkspaces)) {
        directoriesToLoad.set(worktreeDirectory.id, worktreeDirectory)
      }
    }
    for (const directory of directoriesToLoad.values()) {
      if (directory.chatsLoaded) continue
      void loadDirectoryChats(directory.id)
    }
  }, [allWorkspaces, visibleDirectories])
}
