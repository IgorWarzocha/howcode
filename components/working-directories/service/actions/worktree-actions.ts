import type { ActionHandlerResult } from '../../../../desktop/app-service/action-router-result.ts'
import {
  handledAction,
  unhandledAction,
} from '../../../../desktop/app-service/action-router-result.ts'
import { withDirectoryTeardown } from '../../../../desktop/runtime/directory-activity.ts'
import {
  getBranchName,
  getRootDirectoryId,
  getWorktreeActionTargets,
  getWorktreeDirectory,
  getWorktreePath,
  type WorktreeActionTarget,
} from '../../../../shared/desktop-action-payloads.ts'
import type { DesktopAction } from '../../../../shared/desktop-actions.ts'
import type { AnyDesktopActionPayload } from '../../../../shared/desktop-contracts.ts'
import {
  getActiveBranch,
  getMainWorktreePath,
  pruneDirectoryBranch,
  withRootGitMutation,
} from '../../../git/service/index.ts'
import type { WorkingDirectoryPeers } from '../dependencies.ts'
import {
  type RegisteredWorktree,
  resolveRegisteredWorktree,
  resolveRegisteredWorktrees,
} from '../directory-worktrees/registered-worktree.ts'
import {
  getDirectoryWorktreeDirectory,
  hasRunningDirectoryChat,
  listDirectoryFamilyBranchChatIds,
  listDirectoryWorktreePaths,
  setDirectoryWorktreeCompleted,
  setDirectoryWorktreeDirectory,
} from '../state.ts'
import { createRegisteredWorktree } from './worktree-creation.ts'
import { createWorktreeLifecycle } from './worktree-lifecycle.ts'

async function cleanupWorktrees(
  worktrees: RegisteredWorktree[],
  options: { merge: boolean; pruneBranch: boolean },
  removeRegisteredWorktree: ReturnType<typeof createWorktreeLifecycle>['removeRegisteredWorktree'],
) {
  let didMutate = false
  const removedWorktreeIds: string[] = []
  const messages: string[] = []
  for (const worktree of worktrees) {
    const result = await removeRegisteredWorktree({ worktree, ...options })
    didMutate = didMutate || result.didMutate
    if (result.worktreeRemoved) removedWorktreeIds.push(result.directoryId)
    if (result.message) messages.push(result.message)
    if (result.error) {
      return {
        ...result,
        didMutate,
        ...(messages.length > 0 ? { message: messages.join(' ') } : {}),
        failedWorktreeBranchName: result.branchName,
        failedWorktreePath: result.directoryId,
        removedWorktreeIds,
      }
    }
  }

  return {
    didMutate,
    removedWorktreeIds,
    ...(messages.length > 0 ? { message: messages.join(' ') } : {}),
  }
}

export function createWorktreeActionHandler(peers: WorkingDirectoryPeers) {
  const { hasActiveWorkspaceTerminal } = peers
  const { deleteWorkspaceChats, removeRegisteredWorktree } = createWorktreeLifecycle(peers)

  function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error)
  }

  function isMissingBranchPruneError(result: Awaited<ReturnType<typeof pruneDirectoryBranch>>) {
    if (!('error' in result)) return false
    const normalizedError = String(result.error).toLowerCase()
    return normalizedError.includes('branch') && normalizedError.includes('not found')
  }

  async function resolveWorktree(directoryId: string, worktreePath: string) {
    try {
      return await resolveRegisteredWorktree(directoryId, worktreePath)
    } catch (error) {
      return { error: errorMessage(error) }
    }
  }

  async function handleCreateWorktree(payload: AnyDesktopActionPayload) {
    const directoryId = getRootDirectoryId(payload)
    const branchName = getBranchName(payload)
    if (!(directoryId && branchName)) return handledAction({ error: 'Branch name is required.' })

    const rootDirectoryId = await getMainWorktreePath(directoryId)
    const worktreeDirectory =
      getWorktreeDirectory(payload) ?? getDirectoryWorktreeDirectory(rootDirectoryId)
    return withRootGitMutation(rootDirectoryId, async () => {
      const parentBranchName = await getActiveBranch(rootDirectoryId)
      if (!parentBranchName) {
        return handledAction({
          error: 'Switch the parent worktree to a branch before creating one.',
        })
      }
      return handledAction(
        await createRegisteredWorktree({
          rootDirectoryId,
          branchName,
          parentBranchName,
          worktreeDirectory,
        }),
      )
    })
  }

  async function handleSetWorktreeDirectory(payload: AnyDesktopActionPayload) {
    const directoryId = getRootDirectoryId(payload)
    const worktreeDirectory = getWorktreeDirectory(payload)
    if (!(directoryId && worktreeDirectory)) {
      return handledAction({ error: 'Worktree directory is required.' })
    }

    const rootDirectoryId = await getMainWorktreePath(directoryId)
    setDirectoryWorktreeDirectory(rootDirectoryId, worktreeDirectory)
    return handledAction({ didMutate: true, rootDirectoryId })
  }

  async function handleMarkWorktree(payload: AnyDesktopActionPayload, completed: boolean) {
    const directoryId = getRootDirectoryId(payload)
    const worktreePath = getWorktreePath(payload)
    if (!(directoryId && worktreePath)) {
      return handledAction({ error: 'Worktree path is required.' })
    }

    const worktree = await resolveWorktree(directoryId, worktreePath)
    if ('error' in worktree) return handledAction(worktree)
    if (!worktree.metadata) {
      return handledAction({ error: 'Worktree metadata is not registered with Howcode.' })
    }
    if (!setDirectoryWorktreeCompleted(worktree.directoryId, completed)) {
      return handledAction({ error: 'Worktree metadata could not be updated.' })
    }
    return handledAction({
      didMutate: true,
      rootDirectoryId: worktree.rootDirectoryId,
      directoryId: worktree.directoryId,
    })
  }

  async function handleSingleWorktreeRemoval(
    payload: AnyDesktopActionPayload,
    options: { merge: boolean },
  ) {
    const directoryId = getRootDirectoryId(payload)
    const worktreePath = getWorktreePath(payload)
    if (!(directoryId && worktreePath)) {
      return handledAction({ error: 'Worktree path is required.' })
    }

    const worktree = await resolveWorktree(directoryId, worktreePath)
    if ('error' in worktree) return handledAction(worktree)
    return handledAction(
      await removeRegisteredWorktree({ worktree, merge: options.merge, pruneBranch: true }),
    )
  }

  type CleanupRequirements = {
    completedOnly?: boolean
  }

  async function resolveCleanupTargets(
    directoryId: string,
    targets: WorktreeActionTarget[],
    requirements: CleanupRequirements = {},
  ) {
    const worktrees = await resolveRegisteredWorktrees(
      directoryId,
      targets.map((target) => target.worktreePath),
    )
    if ('error' in worktrees) return worktrees

    for (const worktree of worktrees) {
      if (requirements.completedOnly && worktree.metadata?.completed !== true) {
        return {
          error: 'Only worktrees currently marked complete can be handled in bulk.',
          failedWorktreePath: worktree.directoryId,
        }
      }
    }

    return { worktrees }
  }

  async function resolveBranchPruneWorktrees(rootDirectoryId: string, branchName: string) {
    const resolved = await resolveRegisteredWorktrees(
      rootDirectoryId,
      listDirectoryWorktreePaths(rootDirectoryId),
      { skipMissing: true },
    )
    if ('error' in resolved) return resolved

    return {
      worktrees: resolved.filter((worktree) => {
        const associatedBranchName =
          worktree.metadata?.parentBranchName?.trim() || worktree.branchName?.trim() || null
        return associatedBranchName === branchName
      }),
    }
  }

  async function finishBranchPrune(
    rootDirectoryId: string,
    branchName: string,
    worktreeCleanup: Awaited<ReturnType<typeof cleanupWorktrees>>,
  ) {
    const chatIds = listDirectoryFamilyBranchChatIds(rootDirectoryId, branchName)
    const result = await withRootGitMutation(rootDirectoryId, async () => {
      const remaining = await resolveBranchPruneWorktrees(rootDirectoryId, branchName)
      if ('error' in remaining) return remaining
      if (remaining.worktrees.length > 0) {
        return { error: 'Worktrees changed while this branch was being pruned. Try again.' }
      }
      return pruneDirectoryBranch(rootDirectoryId, branchName)
    })
    const didMutate =
      worktreeCleanup.didMutate || ('didMutate' in result && result.didMutate === true)
    if (!('error' in result) || isMissingBranchPruneError(result)) {
      const cleanupError = await deleteWorkspaceChats(chatIds)
      if (cleanupError) {
        return handledAction({
          ...cleanupError,
          didMutate: true,
          message: worktreeCleanup.message,
          removedWorktreeIds: worktreeCleanup.removedWorktreeIds,
          rootDirectoryId,
        })
      }
    }
    if (isMissingBranchPruneError(result)) {
      return handledAction({
        didMutate: true,
        message: worktreeCleanup.message,
        removedWorktreeIds: worktreeCleanup.removedWorktreeIds,
        rootDirectoryId,
      })
    }
    return handledAction({
      ...result,
      ...('error' in result ? { didMutate } : {}),
      message: worktreeCleanup.message,
      removedWorktreeIds: worktreeCleanup.removedWorktreeIds,
      rootDirectoryId,
    })
  }

  async function handleCompletedWorktrees(
    payload: AnyDesktopActionPayload,
    options: { merge: boolean },
  ) {
    const directoryId = getRootDirectoryId(payload)
    const targets = getWorktreeActionTargets(payload)
    if (!directoryId) return handledAction({ error: 'WorkingDirectory is required.' })
    if (targets.length === 0) return handledAction({ error: 'No completed worktrees selected.' })

    const rootDirectoryId = await getMainWorktreePath(directoryId)
    const resolved = await resolveCleanupTargets(rootDirectoryId, targets, { completedOnly: true })
    if ('error' in resolved) return handledAction({ ...resolved, rootDirectoryId })

    return handledAction({
      ...(await cleanupWorktrees(
        resolved.worktrees,
        {
          merge: options.merge,
          pruneBranch: true,
        },
        removeRegisteredWorktree,
      )),
      rootDirectoryId,
    })
  }

  async function handlePruneBranch(payload: AnyDesktopActionPayload) {
    const directoryId = getRootDirectoryId(payload)
    const branchName = getBranchName(payload)
    if (!(directoryId && branchName)) return handledAction()
    const rootDirectoryId = await getMainWorktreePath(directoryId)
    return withDirectoryTeardown(rootDirectoryId, async () => {
      if (
        hasRunningDirectoryChat(rootDirectoryId) ||
        (await hasActiveWorkspaceTerminal(rootDirectoryId))
      ) {
        return handledAction({ error: 'Stop running sessions before pruning this branch.' })
      }

      const resolved = await resolveBranchPruneWorktrees(rootDirectoryId, branchName)
      if ('error' in resolved) return handledAction({ ...resolved, rootDirectoryId })
      const worktreeCleanup = await cleanupWorktrees(
        resolved.worktrees,
        {
          merge: false,
          pruneBranch: false,
        },
        removeRegisteredWorktree,
      )
      if ('error' in worktreeCleanup && worktreeCleanup.error) {
        return handledAction({ ...worktreeCleanup, rootDirectoryId })
      }
      return finishBranchPrune(rootDirectoryId, branchName, worktreeCleanup)
    })
  }

  async function handleWorktreeDesktopAction(
    action: DesktopAction,
    payload: AnyDesktopActionPayload,
  ): Promise<ActionHandlerResult> {
    switch (action) {
      case 'worktrees.create-worktree':
        return handleCreateWorktree(payload)
      case 'worktrees.remove-worktree':
        return handleSingleWorktreeRemoval(payload, { merge: false })
      case 'worktrees.mark-worktree-complete':
        return handleMarkWorktree(payload, true)
      case 'worktrees.mark-worktree-incomplete':
        return handleMarkWorktree(payload, false)
      case 'worktrees.merge-worktree':
        return handleSingleWorktreeRemoval(payload, { merge: true })
      case 'worktrees.merge-completed-worktrees':
        return handleCompletedWorktrees(payload, { merge: true })
      case 'worktrees.remove-completed-worktrees':
        return handleCompletedWorktrees(payload, { merge: false })
      case 'worktrees.set-worktree-directory':
        return handleSetWorktreeDirectory(payload)
      case 'worktrees.prune-branch':
        return handlePruneBranch(payload)
      default:
        return unhandledAction()
    }
  }

  return handleWorktreeDesktopAction
}
