import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import type {
  ArchivedThread,
  ComposerState,
  ComposerStateRequest,
  ProjectGitState,
} from '../desktop/types'
import {
  desktopQueryKeys,
  getArchivedThreadsQuery,
  getComposerStateQuery,
  getProjectGitStateQuery,
  listComposerAttachmentEntriesQuery,
  pickComposerAttachmentsQuery,
} from '../query/desktop-query'
import { useDesktopProjectThreads } from './useDesktopProjectThreads'

export function useDesktopShellQueries() {
  const queryClient = useQueryClient()
  const loadProjectThreads = useDesktopProjectThreads()
  const loadArchivedThreads = useCallback(
    () =>
      queryClient.fetchQuery<ArchivedThread[]>({
        queryKey: desktopQueryKeys.archivedThreads(),
        queryFn: getArchivedThreadsQuery,
        staleTime: 0,
      }),
    [queryClient],
  )
  const loadComposerState = useCallback(
    (request: ComposerStateRequest = {}) =>
      queryClient.fetchQuery<ComposerState | null>({
        queryKey: desktopQueryKeys.composerState(request),
        queryFn: () => getComposerStateQuery(request),
        staleTime: 0,
      }),
    [queryClient],
  )
  const loadProjectGitState = useCallback(
    (projectId: string) =>
      queryClient.fetchQuery<ProjectGitState | null>({
        queryKey: desktopQueryKeys.projectGitState(projectId),
        queryFn: () => getProjectGitStateQuery(projectId),
        staleTime: 0,
      }),
    [queryClient],
  )
  const pickComposerAttachments = useCallback(
    async (projectId?: string | null) => pickComposerAttachmentsQuery(projectId ?? null),
    [],
  )
  const listComposerAttachmentEntries = useCallback(
    async (request: {
      projectId?: string | null
      path?: string | null
      rootPath?: string | null
    }) => listComposerAttachmentEntriesQuery(request),
    [],
  )
  return {
    loadArchivedThreads,
    loadComposerState,
    listComposerAttachmentEntries,
    loadProjectGitState,
    loadProjectThreads,
    pickComposerAttachments,
  }
}
