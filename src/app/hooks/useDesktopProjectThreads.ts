import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { getLocalDraftChatGroupId, isLocalSessionPath } from '../../../shared/session-paths'
import type { ShellState, Thread } from '../desktop/types'
import { desktopQueryKeys, getProjectThreadsQuery } from '../query/desktop-query'

function hasSameThread(threads: Thread[], candidate: Thread) {
  return threads.some(
    (thread) =>
      thread.id === candidate.id ||
      (thread.sessionPath && candidate.sessionPath && thread.sessionPath === candidate.sessionPath),
  )
}

type ThreadsScope = 'chat' | 'code'

function localDraftMatchesScope(thread: Thread, threadsScope: ThreadsScope) {
  if (!(thread.sessionPath && isLocalSessionPath(thread.sessionPath))) return false
  const chatGroupId = getLocalDraftChatGroupId(thread.sessionPath)
  return threadsScope === 'chat' ? chatGroupId !== null : chatGroupId === null
}

export function preserveLocalDraftThreads(
  fetchedThreads: Thread[],
  currentThreads: Thread[],
  threadsScope: ThreadsScope,
) {
  const localDrafts = currentThreads.filter((thread) =>
    localDraftMatchesScope(thread, threadsScope),
  )
  const preservedDrafts = localDrafts.filter((draft) => !hasSameThread(fetchedThreads, draft))
  return [...preservedDrafts, ...fetchedThreads]
}

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
          projects: currentState.projects.map((project) => {
            if (project.id !== projectId) return project
            const mergedThreads = preserveLocalDraftThreads(threads, project.threads, threadsScope)
            return {
              ...project,
              threads: mergedThreads,
              threadCount: mergedThreads.length,
              threadsLoaded: true,
              threadsScope,
            }
          }),
        }
      })
      return threads
    },
    [queryClient],
  )
}
