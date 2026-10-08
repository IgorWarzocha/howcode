import { notifyDirectoryDiffInvalidated } from '@howaboua/howcode-git/ui'
import type { QueryClient } from '@tanstack/react-query'
import type { ActionPayload } from '../../../../../src/app/app-shell/controller-action-utils'
import { getPayloadDirectoryId } from '../../../../../src/app/app-shell/controller-action-utils'
import type { DesktopActionResult, DirectoryGitState } from '../../../../../src/app/desktop/types'
import { desktopQueryKeys } from '../../../../../src/app/query/desktop-query'
import {
  removeShellWorktreeDirectory,
  setShellWorktreeCompleted,
  setShellWorktreeDirectory,
  upsertShellWorktreeDirectory,
} from '../directory-shell-cache'

export async function applySwitchBranchPostEffect(input: {
  contextualPayload: ActionPayload
  actionResult?: DesktopActionResult | null | undefined
  queryClient: QueryClient
  loadDirectoryGitState: (directoryId: string) => Promise<DirectoryGitState | null>
  loadDirectoryChats: (directoryId: string) => Promise<unknown>
  setDirectoryGitState: (state: DirectoryGitState | null) => void
}) {
  const directoryId =
    input.actionResult?.result?.rootDirectoryId ?? getPayloadDirectoryId(input.contextualPayload)
  if (!directoryId) return

  for (const removedWorktreeId of input.actionResult?.result?.removedWorktreeIds ?? []) {
    removeShellWorktreeDirectory(input.queryClient, removedWorktreeId)
  }

  notifyDirectoryDiffInvalidated(directoryId)
  await Promise.all([
    input.queryClient.invalidateQueries({
      queryKey: desktopQueryKeys.directoryGitState(directoryId),
    }),
    input.queryClient.invalidateQueries({ queryKey: desktopQueryKeys.directoryChats(directoryId) }),
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
  await input.loadDirectoryChats(directoryId)
  input.setDirectoryGitState(await input.loadDirectoryGitState(directoryId))
}

export async function applyCreateWorktreePostEffect(input: {
  actionResult: DesktopActionResult | null
  queryClient: QueryClient
  loadDirectoryGitState: (directoryId: string) => Promise<DirectoryGitState | null>
  setDirectoryGitState: (state: DirectoryGitState | null) => void
}) {
  const rootDirectoryId = input.actionResult?.result?.rootDirectoryId
  const worktreeDirectoryId = input.actionResult?.result?.directoryId
  const branchName = input.actionResult?.result?.branchName ?? null
  if (rootDirectoryId && worktreeDirectoryId) {
    upsertShellWorktreeDirectory(input.queryClient, {
      rootDirectoryId,
      worktreeDirectoryId,
      branchName,
      parentBranchName: input.actionResult?.result?.parentBranchName ?? null,
    })
  }
  const directoryIds = [
    ...new Set([rootDirectoryId, worktreeDirectoryId].filter(Boolean)),
  ] as string[]
  if (directoryIds.length === 0) return

  await Promise.all(
    directoryIds.map((directoryId) =>
      input.queryClient.invalidateQueries({
        queryKey: desktopQueryKeys.directoryGitState(directoryId),
      }),
    ),
  )
  if (rootDirectoryId)
    input.setDirectoryGitState(await input.loadDirectoryGitState(rootDirectoryId))
}

export async function applyWorktreeMetadataPostEffect(input: {
  action: string
  contextualPayload: ActionPayload
  actionResult: DesktopActionResult | null
  queryClient: QueryClient
  loadDirectoryGitState: (directoryId: string) => Promise<DirectoryGitState | null>
  setDirectoryGitState: (state: DirectoryGitState | null) => void
}) {
  const rootDirectoryId = input.actionResult?.result?.rootDirectoryId
  const worktreeDirectoryId = input.actionResult?.result?.directoryId
  if (!rootDirectoryId) return

  if (
    input.contextualPayload.worktreeDirectory &&
    typeof input.contextualPayload.worktreeDirectory === 'string'
  ) {
    setShellWorktreeDirectory(
      input.queryClient,
      rootDirectoryId,
      input.contextualPayload.worktreeDirectory,
    )
  }
  if (worktreeDirectoryId) {
    if (input.action === 'worktrees.mark-worktree-complete') {
      setShellWorktreeCompleted(input.queryClient, worktreeDirectoryId, true)
    }
    if (input.action === 'worktrees.mark-worktree-incomplete') {
      setShellWorktreeCompleted(input.queryClient, worktreeDirectoryId, false)
    }
  }

  await input.queryClient.invalidateQueries({
    queryKey: desktopQueryKeys.directoryGitState(rootDirectoryId),
  })
  input.setDirectoryGitState(await input.loadDirectoryGitState(rootDirectoryId))
}

export async function applyRemoveWorktreePostEffect(input: {
  actionResult: DesktopActionResult | null
  queryClient: QueryClient
  loadDirectoryGitState: (directoryId: string) => Promise<DirectoryGitState | null>
  setDirectoryGitState: (state: DirectoryGitState | null) => void
}) {
  const rootDirectoryId = input.actionResult?.result?.rootDirectoryId
  const removedWorktreeIds =
    input.actionResult?.result?.removedWorktreeIds ??
    (input.actionResult?.result?.worktreeRemoved && input.actionResult.result.directoryId
      ? [input.actionResult.result.directoryId]
      : [])
  if (!rootDirectoryId) return
  if (input.actionResult?.result?.worktreeCompleted && input.actionResult.result.directoryId) {
    setShellWorktreeCompleted(input.queryClient, input.actionResult.result.directoryId, true)
  }
  for (const removedWorktreeId of removedWorktreeIds) {
    removeShellWorktreeDirectory(input.queryClient, removedWorktreeId)
  }
  await input.queryClient.invalidateQueries({
    queryKey: desktopQueryKeys.directoryGitState(rootDirectoryId),
  })
  const nextDirectoryGitState = await input.loadDirectoryGitState(rootDirectoryId)
  input.setDirectoryGitState(nextDirectoryGitState)
}
