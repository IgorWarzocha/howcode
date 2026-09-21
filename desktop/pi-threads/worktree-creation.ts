import { createProjectWorktree, removeProjectWorktree } from '../project-git.ts'
import { registerManagedWorktree } from '../thread-state-db.ts'

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export async function createRegisteredWorktree(input: {
  branchName: string
  parentBranchName: string
  rootProjectId: string
  worktreeDirectory: string
}) {
  const created = await createProjectWorktree({
    projectId: input.rootProjectId,
    branchName: input.branchName,
    worktreeDirectory: input.worktreeDirectory,
  })
  if ('error' in created) return created

  try {
    registerManagedWorktree({ ...created, parentBranchName: input.parentBranchName })
  } catch (error) {
    const cleanup = await removeProjectWorktree(
      created.rootProjectId,
      created.projectId,
      created.branchName,
    )
    const persistenceError = errorMessage(error)
    if ('error' in cleanup) {
      return {
        didMutate: true as const,
        branchName: created.branchName,
        parentBranchName: input.parentBranchName,
        projectId: created.projectId,
        rootProjectId: created.rootProjectId,
        error: `Worktree was created but could not be registered or removed: ${persistenceError} ${cleanup.error}`,
      }
    }
    return {
      didMutate: true as const,
      rootProjectId: created.rootProjectId,
      error: `Worktree could not be registered and was removed: ${persistenceError}${cleanup.warning ? ` ${cleanup.warning}` : ''}`,
    }
  }

  return {
    didMutate: true as const,
    branchName: created.branchName,
    parentBranchName: input.parentBranchName,
    projectId: created.projectId,
    rootProjectId: created.rootProjectId,
    ...(created.warning ? { message: created.warning } : {}),
  }
}
