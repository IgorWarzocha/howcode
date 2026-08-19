import type { DesktopActionInvoker } from '../../../desktop/types'

export async function createThreadForBranch({
  branchName,
  onAction,
  projectId,
}: {
  branchName: string | null
  onAction: DesktopActionInvoker
  projectId: string
}) {
  return await onAction('thread.new', { projectId, composerMode: 'code', branchName })
}

export async function createThreadInWorktreeForBranch({
  branchName,
  onAction,
  projectId,
}: {
  branchName: string
  onAction: DesktopActionInvoker
  projectId: string
}) {
  const worktreeResult = await onAction('workspace.create-worktree', {
    rootProjectId: projectId,
    branchName,
  })
  const worktreeError = worktreeResult?.result?.error
  if (!worktreeResult?.ok || worktreeError || !worktreeResult.result?.projectId) {
    return {
      error:
        typeof worktreeError === 'string' && worktreeError.trim().length > 0
          ? worktreeError
          : 'Could not create worktree.',
    }
  }

  const normalizedBranchName = worktreeResult.result.branchName ?? branchName
  const threadResult = await createThreadForBranch({
    branchName: normalizedBranchName,
    onAction,
    projectId: worktreeResult.result.projectId,
  })
  const threadError = threadResult?.result?.error
  if (!threadResult?.ok || threadError) {
    return {
      error:
        typeof threadError === 'string' && threadError.trim().length > 0
          ? `Worktree created, but could not start a session: ${threadError}`
          : 'Worktree created, but could not start a session.',
    }
  }
  return { didMutate: true }
}
