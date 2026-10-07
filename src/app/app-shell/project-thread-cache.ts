import { isLocalConversationId } from '@howcode/shared/conversation-ids'
import type { ShellState, Thread } from '../desktop/types'
import { desktopQueryKeys } from '../query/desktop-query'
import { mergeThreadCacheFields } from './thread-cache-merge'

type QueryClientLike = {
  setQueryData: (queryKey: readonly unknown[], updater: (current: unknown) => unknown) => void
}

type ApplyProjectThreadOptions = {
  replaceConversationId?: string | null
  revealProject?: boolean
}

function sameThread(left: Thread, right: Thread, replaceConversationId: string | null) {
  if (left.id === right.id) {
    return true
  }

  if (left.conversationId && right.conversationId && left.conversationId === right.conversationId) {
    return true
  }

  return Boolean(replaceConversationId && left.conversationId === replaceConversationId)
}

export function applyProjectThreadToShellState(
  queryClient: QueryClientLike,
  projectId: string,
  thread: Thread,
  options: ApplyProjectThreadOptions = {},
) {
  const replaceConversationId = options.replaceConversationId ?? null
  const revealProject = options.revealProject ?? false

  queryClient.setQueryData(desktopQueryKeys.shellState(), (current) => {
    const currentState = current as ShellState | null | undefined
    if (!currentState) {
      return currentState ?? null
    }

    return {
      ...currentState,
      projects: currentState.projects.map((project) => {
        if (project.id !== projectId) {
          return project
        }

        const existingThread = project.threads.find((candidate) =>
          sameThread(candidate, thread, replaceConversationId),
        )
        const nextThread = mergeThreadCacheFields(existingThread, thread)
        const remainingThreads = project.threads.filter(
          (candidate) => !sameThread(candidate, thread, replaceConversationId),
        )
        const threads = [nextThread, ...remainingThreads]

        return {
          ...project,
          threads,
          threadCount: Math.max(project.threadCount ?? 0, threads.length),
          threadsLoaded: true,
          latestModifiedMs: Math.max(project.latestModifiedMs ?? 0, thread.lastModifiedMs ?? 0),
          collapsed: revealProject ? false : project.collapsed,
        }
      }),
    }
  })
}

export function getDraftReplacementConversationId(
  selectedConversationId: string | null,
  selectedProjectId: string,
  eventProjectId: string,
) {
  return selectedProjectId === eventProjectId && isLocalConversationId(selectedConversationId)
    ? selectedConversationId
    : null
}

export function removeProjectThreadFromShellState(
  queryClient: QueryClientLike,
  projectId: string,
  conversationId: string,
) {
  queryClient.setQueryData(desktopQueryKeys.shellState(), (current) => {
    const currentState = current as ShellState | null | undefined
    if (!currentState) {
      return currentState ?? null
    }

    return {
      ...currentState,
      projects: currentState.projects.map((project) => {
        if (project.id !== projectId) {
          return project
        }

        const threads = project.threads.filter((thread) => thread.conversationId !== conversationId)
        const removedThreadCount = project.threads.length - threads.length
        const indexedThreadCount = project.threadCount ?? project.threads.length
        const nextThreadCount =
          indexedThreadCount > project.threads.length
            ? indexedThreadCount
            : Math.max(threads.length, indexedThreadCount - removedThreadCount)

        return {
          ...project,
          threads,
          threadCount: nextThreadCount,
        }
      }),
    }
  })
}
