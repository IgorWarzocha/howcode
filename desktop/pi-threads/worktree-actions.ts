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
import { getActiveBranch } from '../project-git/project-state.ts'
import { createProjectWorktree, getMainWorktreePath, pruneProjectBranch } from '../project-git.ts'
import {
  type RegisteredWorktree,
  resolveRegisteredWorktree,
  resolveRegisteredWorktrees,
} from '../project-worktrees/registered-worktree.ts'
import {
  ensureProject,
  getProjectWorktreeDirectory,
  hasRunningProjectThread,
  listProjectFamilyBranchThreadIds,
  listProjectWorktreePaths,
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
  const parentBranchName = await getActiveBranch(rootProjectId)
  if (!parentBranchName) {
    return handledAction({ error: 'Switch the parent worktree to a branch before creating one.' })
  }
  const result = await createProjectWorktree({ projectId, branchName, worktreeDirectory })
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
    ...(result.warning ? { message: result.warning } : {}),
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
  if (!worktree.metadata) {
    return handledAction({ error: 'Worktree metadata is not registered with Howcode.' })
  }
  if (!setProjectWorktreeCompleted(worktree.worktreePath, completed)) {
    return handledAction({ error: 'Worktree metadata could not be updated.' })
  }
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

type CleanupRequirements = {
  completedOnly?: boolean
}

async function resolveCleanupTargets(
  projectId: string,
  targets: WorktreeActionTarget[],
  requirements: CleanupRequirements = {},
) {
  const worktrees = await resolveRegisteredWorktrees(
    projectId,
    targets.map((target) => target.worktreePath),
  )
  if ('error' in worktrees) return worktrees

  for (const worktree of worktrees) {
    if (requirements.completedOnly && worktree.metadata?.completed !== true) {
      return {
        error: 'Only worktrees currently marked complete can be handled in bulk.',
        failedWorktreePath: worktree.worktreePath,
      }
    }
  }

  return { worktrees }
}

async function cleanupWorktrees(
  worktrees: RegisteredWorktree[],
  options: { merge: boolean; pruneBranch: boolean },
) {
  let didMutate = false
  const removedWorktreeIds: string[] = []
  for (const worktree of worktrees) {
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

  const rootProjectId = await getMainWorktreePath(projectId)
  const resolved = await resolveCleanupTargets(rootProjectId, targets, { completedOnly: true })
  if ('error' in resolved) return handledAction({ ...resolved, rootProjectId })

  return handledAction({
    ...(await cleanupWorktrees(resolved.worktrees, {
      merge: options.merge,
      pruneBranch: true,
    })),
    rootProjectId,
  })
}

async function handlePruneBranch(payload: AnyDesktopActionPayload) {
  const projectId = getRootProjectId(payload)
  const branchName = getBranchName(payload)
  if (!(projectId && branchName)) return handledAction()
  const rootProjectId = await getMainWorktreePath(projectId)
  if (hasRunningProjectThread(rootProjectId)) {
    return handledAction({ error: 'Stop running sessions before pruning this branch.' })
  }

  const resolved = await resolveRegisteredWorktrees(
    rootProjectId,
    listProjectWorktreePaths(rootProjectId),
    { skipMissing: true },
  )
  if ('error' in resolved) return handledAction({ ...resolved, rootProjectId })
  const worktrees = resolved.filter((worktree) => {
    const associatedBranchName =
      worktree.metadata?.parentBranchName?.trim() || worktree.branchName?.trim() || null
    return associatedBranchName === branchName
  })
  const worktreeCleanup = await cleanupWorktrees(worktrees, {
    merge: false,
    pruneBranch: false,
  })
  if ('error' in worktreeCleanup && worktreeCleanup.error) {
    return handledAction({ ...worktreeCleanup, rootProjectId })
  }

  const threadIds = listProjectFamilyBranchThreadIds(rootProjectId, branchName)
  const result = await pruneProjectBranch(rootProjectId, branchName)
  const didMutate = worktreeCleanup.didMutate || result.didMutate === true
  if (!('error' in result) || isMissingBranchPruneError(result)) {
    const cleanupError = await deleteWorkspaceThreads(threadIds)
    if (cleanupError) {
      return handledAction({
        ...cleanupError,
        didMutate: true,
        removedWorktreeIds: worktreeCleanup.removedWorktreeIds,
        rootProjectId,
      })
    }
  }
  if (isMissingBranchPruneError(result)) {
    return handledAction({
      didMutate: true,
      removedWorktreeIds: worktreeCleanup.removedWorktreeIds,
      rootProjectId,
    })
  }
  return handledAction(
    'error' in result
      ? {
          ...result,
          didMutate,
          removedWorktreeIds: worktreeCleanup.removedWorktreeIds,
          rootProjectId,
        }
      : {
          ...result,
          removedWorktreeIds: worktreeCleanup.removedWorktreeIds,
          rootProjectId,
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
