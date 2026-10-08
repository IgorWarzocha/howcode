import { getDirectoryGitStateQuery } from '@howcode/components/coding/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import type {
  ArchivedChat,
  ComposerState,
  ComposerStateRequest,
  DirectoryGitState,
} from '../desktop/types'
import {
  desktopQueryKeys,
  getArchivedChatsQuery,
  getComposerStateQuery,
  listComposerAttachmentEntriesQuery,
} from '../query/desktop-query'
import { useDesktopDirectoryChats } from './useDesktopDirectoryChats'

export function useDesktopShellQueries() {
  const queryClient = useQueryClient()
  const loadDirectoryChats = useDesktopDirectoryChats()
  const loadArchivedChats = useCallback(
    () =>
      queryClient.fetchQuery<ArchivedChat[]>({
        queryKey: desktopQueryKeys.archivedChats(),
        queryFn: getArchivedChatsQuery,
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
  const loadDirectoryGitState = useCallback(
    (directoryId: string) =>
      queryClient.fetchQuery<DirectoryGitState | null>({
        queryKey: desktopQueryKeys.directoryGitState(directoryId),
        queryFn: () => getDirectoryGitStateQuery(directoryId),
        staleTime: 0,
      }),
    [queryClient],
  )
  const listComposerAttachmentEntries = useCallback(
    async (request: {
      directoryId?: string | null
      path?: string | null
      rootPath?: string | null
    }) => listComposerAttachmentEntriesQuery(request),
    [],
  )
  return {
    loadArchivedChats,
    loadComposerState,
    listComposerAttachmentEntries,
    loadDirectoryGitState,
    loadDirectoryChats,
  }
}
