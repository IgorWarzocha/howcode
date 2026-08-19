import type { DesktopAction } from '../../shared/desktop-actions.ts'
import type { AnyDesktopActionPayload } from '../../shared/desktop-contracts.ts'
import {
  getBranchName,
  getRootProjectId,
  getWorktreeActionTargets,
  getWorktreeDirectory,
  getWorktreePath,
  type WorktreeActionTarget,
} from '../../shared/pi-thread-action-payloads.ts'
import { getBranch } from '../project-git/project-state.ts'
import { createProjectWorktree, getMainWorktreePath, pruneProjectBranch } from '../project-git.ts'
import { resolveRegisteredWorktree } from '../project-worktrees/registered-worktree.ts'
import {
  ensureProject,
  getProjectWorktreeDirectory,
  hasRunningProjectThread,
  listProjectFamilyBranchThreadIds,
  setProjectWorktreeCompleted,
  setProjectWorktreeDirectory,
  upsertProjectWorktree,
} from '../thread-state-db.ts'
import type { ActionHandlerResult } from './action-router-result.ts'
import { handledAction, unhandledAction } from './action-router-result.ts'
import { deleteWorkspaceThreads, removeRegisteredWorktree } from './worktree-lifecycle.ts'

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function isMissingBranchPruneError(result: Awaited<ReturnType<typeof pruneProjectBranch>>) {
  if (!('error' in result)) return false
  const normalizedError = String(result.error).toLowerCase()
  return normalizedError.includes('branch') && normalizedError.includes('not found')
}

async function resolveWorktree(projectId: string, worktreePath: string) {
  try {
    return await resolveRegisteredWorktree(projectId, worktreePath)
  } catch (error) {
    return { error: errorMessage(error) }
  }
}

async function handleCreateWorktree(payload: AnyDesktopActionPayload) {
  const projectId = getRootProjectId(payload)
  const branchName = getBranchName(payload)
  if (!(projectId && branchName)) return handledAction({ error: 'Branch name is required.' })

  const rootProjectId = await getMainWorktreePath(projectId)
  const worktreeDirectory =
    getWorktreeDirectory(payload) ?? getProjectWorktreeDirectory(rootProjectId)
  const [parentBranchName, result] = await Promise.all([
    getBranch(rootProjectId),
    createProjectWorktree({ projectId, branchName, worktreeDirectory }),
  ])
  if ('error' in result) return handledAction(result)

  ensureProject(result.rootProjectId)
  ensureProject(result.projectId)
  upsertProjectWorktree({
    cwd: result.rootProjectId,
    rootCwd: result.rootProjectId,
    branchName: null,
    isMain: true,
    source: 'howcode',
  })
  upsertProjectWorktree({
    cwd: result.projectId,
    rootCwd: result.rootProjectId,
    branchName: result.branchName,
    parentBranchName,
    isMain: false,
    source: 'howcode',
  })

  return handledAction({
    didMutate: true,
    branchName: result.branchName,
    parentBranchName,
    projectId: result.projectId,
    rootProjectId: result.rootProjectId,
  })
}

async function handleSetWorktreeDirectory(payload: AnyDesktopActionPayload) {
  const projectId = getRootProjectId(payload)
  const worktreeDirectory = getWorktreeDirectory(payload)
  if (!(projectId && worktreeDirectory)) {
    return handledAction({ error: 'Worktree directory is required.' })
  }

  const rootProjectId = await getMainWorktreePath(projectId)
  setProjectWorktreeDirectory(rootProjectId, worktreeDirectory)
  return handledAction({ didMutate: true, rootProjectId })
}

async function handleMarkWorktree(payload: AnyDesktopActionPayload, completed: boolean) {
  const projectId = getRootProjectId(payload)
  const worktreePath = getWorktreePath(payload)
  if (!(projectId && worktreePath)) {
    return handledAction({ error: 'Worktree path is required.' })
  }

  const worktree = await resolveWorktree(projectId, worktreePath)
  if ('error' in worktree) return handledAction(worktree)
  setProjectWorktreeCompleted(worktree.worktreePath, completed)
  return handledAction({
    didMutate: true,
    rootProjectId: worktree.rootProjectId,
    projectId: worktree.worktreePath,
  })
}

async function handleSingleWorktreeRemoval(
  payload: AnyDesktopActionPayload,
  options: { merge: boolean },
) {
  const projectId = getRootProjectId(payload)
  const worktreePath = getWorktreePath(payload)
  if (!(projectId && worktreePath)) {
    return handledAction({ error: 'Worktree path is required.' })
  }

  const worktree = await resolveWorktree(projectId, worktreePath)
  if ('error' in worktree) return handledAction(worktree)
  return handledAction(
    await removeRegisteredWorktree({ worktree, merge: options.merge, pruneBranch: true }),
  )
}

async function cleanupWorktreeTargets(
  projectId: string,
  targets: WorktreeActionTarget[],
  options: { merge: boolean; pruneBranch: boolean },
) {
  let didMutate = false
  const removedWorktreeIds: string[] = []
  for (const target of targets) {
    const worktree = await resolveWorktree(projectId, target.worktreePath)
    if ('error' in worktree) {
      return {
        didMutate,
        error: worktree.error,
        failedWorktreePath: target.worktreePath,
        removedWorktreeIds,
      }
    }

    const result = await removeRegisteredWorktree({ worktree, ...options })
    didMutate = didMutate || result.didMutate
    if (result.worktreeRemoved) removedWorktreeIds.push(result.projectId)
    if (result.error) {
      return {
        ...result,
        didMutate,
        failedWorktreeBranchName: result.branchName,
        failedWorktreePath: result.projectId,
        removedWorktreeIds,
      }
    }
  }

  return { didMutate, removedWorktreeIds }
}

async function handleCompletedWorktrees(
  payload: AnyDesktopActionPayload,
  options: { merge: boolean },
) {
  const projectId = getRootProjectId(payload)
  const targets = getWorktreeActionTargets(payload)
  if (!projectId) return handledAction({ error: 'Project is required.' })
  if (targets.length === 0) return handledAction({ error: 'No completed worktrees selected.' })

  return handledAction({
    ...(await cleanupWorktreeTargets(projectId, targets, {
      merge: options.merge,
      pruneBranch: true,
    })),
    rootProjectId: projectId,
  })
}

async function handlePruneBranch(payload: AnyDesktopActionPayload) {
  const projectId = getRootProjectId(payload)
  const branchName = getBranchName(payload)
  if (!(projectId && branchName)) return handledAction()
  if (hasRunningProjectThread(projectId)) {
    return handledAction({ error: 'Stop running sessions before pruning this branch.' })
  }

  const worktreeCleanup = await cleanupWorktreeTargets(
    projectId,
    getWorktreeActionTargets(payload),
    { merge: false, pruneBranch: false },
  )
  if (worktreeCleanup.error) {
    return handledAction({ ...worktreeCleanup, rootProjectId: projectId })
  }

  const threadIds = listProjectFamilyBranchThreadIds(projectId, branchName)
  const result = await pruneProjectBranch(projectId, branchName)
  const didMutate = worktreeCleanup.didMutate || result.didMutate === true
  if (!('error' in result) || isMissingBranchPruneError(result)) {
    const cleanupError = await deleteWorkspaceThreads(threadIds)
    if (cleanupError) {
      return handledAction({
        ...cleanupError,
        didMutate: true,
        removedWorktreeIds: worktreeCleanup.removedWorktreeIds,
        rootProjectId: projectId,
      })
    }
  }
  if (isMissingBranchPruneError(result)) {
    return handledAction({
      didMutate: true,
      removedWorktreeIds: worktreeCleanup.removedWorktreeIds,
      rootProjectId: projectId,
    })
  }
  return handledAction(
    'error' in result
      ? {
          ...result,
          didMutate,
          removedWorktreeIds: worktreeCleanup.removedWorktreeIds,
          rootProjectId: projectId,
        }
      : {
          ...result,
          removedWorktreeIds: worktreeCleanup.removedWorktreeIds,
          rootProjectId: projectId,
        },
  )
}

export async function handleWorktreeDesktopAction(
  action: DesktopAction,
  payload: AnyDesktopActionPayload,
): Promise<ActionHandlerResult> {
  switch (action) {
    case 'workspace.create-worktree':
      return handleCreateWorktree(payload)
    case 'workspace.remove-worktree':
      return handleSingleWorktreeRemoval(payload, { merge: false })
    case 'workspace.mark-worktree-complete':
      return handleMarkWorktree(payload, true)
    case 'workspace.mark-worktree-incomplete':
      return handleMarkWorktree(payload, false)
    case 'workspace.merge-worktree':
      return handleSingleWorktreeRemoval(payload, { merge: true })
    case 'workspace.merge-completed-worktrees':
      return handleCompletedWorktrees(payload, { merge: true })
    case 'workspace.remove-completed-worktrees':
      return handleCompletedWorktrees(payload, { merge: false })
    case 'workspace.set-worktree-directory':
      return handleSetWorktreeDirectory(payload)
    case 'workspace.prune-branch':
      return handlePruneBranch(payload)
    default:
      return unhandledAction()
  }
}
