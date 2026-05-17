import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import type { ShellState } from '../desktop/types'
import { desktopQueryKeys, getProjectThreadsQuery } from '../query/desktop-query'

export function useDesktopProjectThreads() {
  const queryClient = useQueryClient()
  return useCallback(
    async (projectId: string, options: { chat?: boolean | undefined } = {}) => {
      const threadsScope = options.chat ? 'chat' : 'code'
      const threads = await queryClient.fetchQuery({
        queryKey: desktopQueryKeys.projectThreads(projectId, options.chat === true),
        queryFn: () => getProjectThreadsQuery(projectId, options.chat === true),
        staleTime: 0,
      })
      queryClient.setQueryData<ShellState | null>(desktopQueryKeys.shellState(), (currentState) => {
        if (!currentState) return currentState ?? null
        return {
          ...currentState,
          projects: currentState.projects.map((project) =>
            project.id === projectId
              ? {
                  ...project,
                  threads,
                  threadCount: threads.length,
                  threadsLoaded: true,
                  threadsScope,
                }
              : project,
          ),
        }
      })
      return threads
    },
    [queryClient],
  )
}
