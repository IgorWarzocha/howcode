import type { QueryClient } from '@tanstack/react-query'
import type { ActionPayload } from '../../../../../src/app/app-shell/controller-action-utils'
import { getPayloadDirectoryId } from '../../../../../src/app/app-shell/controller-action-utils'
import type { DirectoryGitState } from '../../../../../src/app/desktop/types'
import { desktopQueryKeys } from '../../../../../src/app/query/desktop-query'
import { notifyDirectoryDiffInvalidated } from '../../hooks/directory-diff-invalidation'

type RefreshDirectoryGitAfterWorktreeChangeInput = {
  contextualPayload: ActionPayload
  queryClient: QueryClient
  loadDirectoryGitState: (directoryId: string) => Promise<DirectoryGitState | null>
  setDirectoryGitState: (state: DirectoryGitState | null) => void
}

async function refreshDirectoryGitAfterWorktreeChange(
  input: RefreshDirectoryGitAfterWorktreeChangeInput,
) {
  const directoryId = getPayloadDirectoryId(input.contextualPayload)
  if (!directoryId) return

  notifyDirectoryDiffInvalidated(directoryId)
  await Promise.all([
    input.queryClient.invalidateQueries({
      queryKey: desktopQueryKeys.directoryDiffStatsPrefix(directoryId),
    }),
    input.queryClient.invalidateQueries({
      queryKey: desktopQueryKeys.directoryDiffImagePreviewPrefix(directoryId),
    }),
    input.queryClient.invalidateQueries({
      queryKey: desktopQueryKeys.directoryCommitsPrefix(directoryId),
    }),
  ])
  input.setDirectoryGitState(await input.loadDirectoryGitState(directoryId))
}

export async function applyWorkspaceCommitPostEffect(
  input: RefreshDirectoryGitAfterWorktreeChangeInput & { committed: boolean },
) {
  if (!input.committed) return
  return refreshDirectoryGitAfterWorktreeChange(input)
}

export async function applyWorkspaceFileWritePostEffect(
  input: RefreshDirectoryGitAfterWorktreeChangeInput & { written: boolean },
) {
  if (!input.written) return
  return refreshDirectoryGitAfterWorktreeChange(input)
}

export async function applyCommitOptionsPostEffect(input: {
  contextualPayload: ActionPayload
  refreshShellState: () => Promise<unknown>
  loadDirectoryGitState: (directoryId: string) => Promise<DirectoryGitState | null>
  setDirectoryGitState: (state: DirectoryGitState | null) => void
}) {
  const directoryId = getPayloadDirectoryId(input.contextualPayload)
  if (directoryId) input.setDirectoryGitState(await input.loadDirectoryGitState(directoryId))
  await input.refreshShellState()
}
