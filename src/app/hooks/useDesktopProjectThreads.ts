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

type ProjectDraftCache = Record<ThreadsScope, Thread[]>

const localDraftCacheByProject = new Map<string, ProjectDraftCache>()

function localDraftMatchesScope(thread: Thread, threadsScope: ThreadsScope) {
  if (!(thread.sessionPath && isLocalSessionPath(thread.sessionPath))) return false
  const chatGroupId = getLocalDraftChatGroupId(thread.sessionPath)
  return threadsScope === 'chat' ? chatGroupId !== null : chatGroupId === null
}

export function preserveLocalDraftThreads(
  fetchedThreads: Thread[],
  currentThreads: Thread[],
  threadsScope: ThreadsScope,
  cachedThreads: Thread[] = [],
) {
  const localDrafts = [...cachedThreads, ...currentThreads].filter((thread) =>
    localDraftMatchesScope(thread, threadsScope),
  )
  const preservedDrafts = localDrafts.filter((draft) => !hasSameThread(fetchedThreads, draft))
  return [...preservedDrafts, ...fetchedThreads]
}

function getLocalDraftCache(projectId: string) {
  return localDraftCacheByProject.get(projectId) ?? { chat: [], code: [] }
}

function setLocalDraftCache(projectId: string, cache: ProjectDraftCache) {
  if (cache.chat.length === 0 && cache.code.length === 0) {
    localDraftCacheByProject.delete(projectId)
    return
  }
  localDraftCacheByProject.set(projectId, cache)
}

function rememberLocalDrafts(projectId: string, threads: Thread[]) {
  const cache = getLocalDraftCache(projectId)
  const nextCache: ProjectDraftCache = { chat: [...cache.chat], code: [...cache.code] }

  for (const thread of threads) {
    if (localDraftMatchesScope(thread, 'chat') && !hasSameThread(nextCache.chat, thread)) {
      nextCache.chat.push(thread)
    }
    if (localDraftMatchesScope(thread, 'code') && !hasSameThread(nextCache.code, thread)) {
      nextCache.code.push(thread)
    }
  }

  setLocalDraftCache(projectId, nextCache)
}

function updateLocalDraftCache(
  projectId: string,
  threadsScope: ThreadsScope,
  fetchedThreads: Thread[],
  preservedThreads: Thread[],
) {
  const cache = getLocalDraftCache(projectId)
  const nextScopeDrafts = preservedThreads.filter((thread) =>
    localDraftMatchesScope(thread, threadsScope),
  )
  const otherScope = threadsScope === 'chat' ? 'code' : 'chat'
  const otherScopeDrafts = cache[otherScope].filter(
    (draft) => !hasSameThread(fetchedThreads, draft),
  )
  setLocalDraftCache(projectId, {
    ...cache,
    [threadsScope]: nextScopeDrafts,
    [otherScope]: otherScopeDrafts,
  })
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
            rememberLocalDrafts(projectId, project.threads)
            const mergedThreads = preserveLocalDraftThreads(
              threads,
              project.threads,
              threadsScope,
              getLocalDraftCache(projectId)[threadsScope],
            )
            updateLocalDraftCache(projectId, threadsScope, threads, mergedThreads)
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
