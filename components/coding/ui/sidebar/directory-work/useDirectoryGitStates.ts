import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { DirectoryGitState } from '../../../../../src/app/desktop/types'
import { desktopQueryKeys } from '../../../../../src/app/query/desktop-query'
import type { WorkingDirectory } from '../../../../../src/app/types'
import { getDirectoryGitStateQuery } from '../../query'

export function useDirectoryGitStates(
  visibleDirectories: readonly WorkingDirectory[],
  directoryGitState: DirectoryGitState | null,
) {
  const gitStateQueries = useQueries({
    queries: visibleDirectories.map((directory) => ({
      queryKey: desktopQueryKeys.directoryGitState(directory.id),
      queryFn: () => getDirectoryGitStateQuery(directory.id),
      staleTime: 0,
    })),
  })

  return useMemo(() => {
    const states = new Map<string, DirectoryGitState | null>()
    for (const [index, directory] of visibleDirectories.entries()) {
      states.set(directory.id, gitStateQueries[index]?.data ?? null)
    }
    if (directoryGitState) states.set(directoryGitState.directoryId, directoryGitState)
    return states
  }, [gitStateQueries, directoryGitState, visibleDirectories])
}
