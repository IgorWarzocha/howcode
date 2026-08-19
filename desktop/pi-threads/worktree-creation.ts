import { createProjectWorktree, removeProjectWorktree } from '../project-git.ts'
import {
  ensureProject,
  runThreadStateTransaction,
  upsertProjectWorktree,
} from '../thread-state-db.ts'

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function persistManagedWorktree(input: {
  branchName: string
  parentBranchName: string
  projectId: string
  rootProjectId: string
}) {
  runThreadStateTransaction(() => {
    ensureProject(input.rootProjectId)
    ensureProject(input.projectId)
    upsertProjectWorktree({
      cwd: input.rootProjectId,
      rootCwd: input.rootProjectId,
      branchName: null,
      isMain: true,
      source: 'howcode',
    })
    upsertProjectWorktree({
      cwd: input.projectId,
      rootCwd: input.rootProjectId,
      branchName: input.branchName,
      parentBranchName: input.parentBranchName,
      isMain: false,
      source: 'howcode',
    })
  })
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
    persistManagedWorktree({ ...created, parentBranchName: input.parentBranchName })
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
