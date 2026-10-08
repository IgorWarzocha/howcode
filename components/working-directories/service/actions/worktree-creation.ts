import { createDirectoryWorktree, removeDirectoryWorktree } from '../../../git/service/index.ts'
import { registerManagedWorktree } from '../state.ts'

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export async function createRegisteredWorktree(input: {
  branchName: string
  parentBranchName: string
  rootDirectoryId: string
  worktreeDirectory: string
}) {
  const created = await createDirectoryWorktree({
    directoryId: input.rootDirectoryId,
    branchName: input.branchName,
    worktreeDirectory: input.worktreeDirectory,
  })
  if ('error' in created) return created

  try {
    registerManagedWorktree({ ...created, parentBranchName: input.parentBranchName })
  } catch (error) {
    const cleanup = await removeDirectoryWorktree(
      created.rootDirectoryId,
      created.directoryId,
      created.branchName,
    )
    const persistenceError = errorMessage(error)
    if ('error' in cleanup) {
      return {
        didMutate: true as const,
        branchName: created.branchName,
        parentBranchName: input.parentBranchName,
        directoryId: created.directoryId,
        rootDirectoryId: created.rootDirectoryId,
        error: `Worktree was created but could not be registered or removed: ${persistenceError} ${cleanup.error}`,
      }
    }
    return {
      didMutate: true as const,
      rootDirectoryId: created.rootDirectoryId,
      error: `Worktree could not be registered and was removed: ${persistenceError}${cleanup.warning ? ` ${cleanup.warning}` : ''}`,
    }
  }

  return {
    didMutate: true as const,
    branchName: created.branchName,
    parentBranchName: input.parentBranchName,
    directoryId: created.directoryId,
    rootDirectoryId: created.rootDirectoryId,
    ...(created.warning ? { message: created.warning } : {}),
  }
}
