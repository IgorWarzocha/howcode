import type { DesktopActionInvoker } from '../../../../../src/app/desktop/types'

export async function createChatForBranch({
  branchName,
  onAction,
  directoryId,
}: {
  branchName: string | null
  onAction: DesktopActionInvoker
  directoryId: string
}) {
  return await onAction('chat.new', { directoryId, composerProfile: 'coding', branchName })
}

export async function createChatInWorktreeForBranch({
  branchName,
  onAction,
  directoryId,
}: {
  branchName: string
  onAction: DesktopActionInvoker
  directoryId: string
}) {
  const worktreeResult = await onAction('worktrees.create-worktree', {
    rootDirectoryId: directoryId,
    branchName,
  })
  const worktreeError = worktreeResult?.result?.error
  if (!worktreeResult?.ok || worktreeError || !worktreeResult.result?.directoryId) {
    return {
      error:
        typeof worktreeError === 'string' && worktreeError.trim().length > 0
          ? worktreeError
          : 'Could not create worktree.',
    }
  }

  const normalizedBranchName = worktreeResult.result.branchName ?? branchName
  const chatResult = await createChatForBranch({
    branchName: normalizedBranchName,
    onAction,
    directoryId: worktreeResult.result.directoryId,
  })
  const chatError = chatResult?.result?.error
  if (!chatResult?.ok || chatError) {
    return {
      error:
        typeof chatError === 'string' && chatError.trim().length > 0
          ? `Worktree created, but could not start a chat: ${chatError}`
          : 'Worktree created, but could not start a chat.',
    }
  }
  return { didMutate: true }
}
