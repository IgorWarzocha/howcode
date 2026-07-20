import type { DesktopAction } from '../../shared/desktop-actions.ts'
import type { AnyDesktopActionPayload } from '../../shared/desktop-contracts.ts'
import {
  getBranchName,
  getComposerRequest,
  getGitCommitMessage,
  getGitIncludeUnstaged,
  getGitIncludeUntracked,
  getGitOpsMode,
  getGitPreview,
  getGitPush,
  getGitRepoUrl,
  getParentBranchName,
  getProjectDiffBaselinePreference,
  getProjectDiffRenderModePreference,
  getProjectId,
  getProjectIds,
  getWorktreeActionTargets,
  getWorktreeDirectory,
  getWorktreePath,
} from '../../shared/pi-thread-action-payloads.ts'
import { getPersistedSessionPath } from '../../shared/session-paths.ts'
import { setSidebarVisibleProjectIds } from '../app-settings/writers.ts'
import { generateGitCommitMessage } from '../git-commit-message.ts'
import { disposeWorkspaceComposerRuns } from '../pi-desktop-runtime.ts'
import {
  commitProjectChanges,
  createProjectWorktree,
  getMainWorktreePath,
  initializeProjectGit,
  mergeProjectBranch,
  pruneProjectBranch,
  removeProjectWorktree,
  setProjectOrigin,
  switchProjectBranch,
} from '../project-git.ts'
import { closeTerminal, listTerminals } from '../terminal/runtime.ts'
import {
  deleteProject,
  ensureProject,
  getProjectWorktreeDirectory,
  hasRunningProjectThread,
  listProjectFamilyBranchThreadIds,
  listProjectSessionPaths,
  listProjectThreadIds,
  setProjectGitOpsMode,
  setProjectRepoOrigin,
  setProjectWorktreeCompleted,
  setProjectWorktreeDirectory,
  setThreadDiffPreferences,
  setThreadRunningState,
  upsertProjectWorktree,
} from '../thread-state-db.ts'
import type { ActionHandlerResult } from './action-router-result.ts'
import { handledAction, unhandledAction } from './action-router-result.ts'
import { deletePersistedThreads } from './thread-actions.ts'

async function closeWorkspaceTerminals(projectId: string) {
  const terminalSnapshots = await listTerminals()
  await Promise.all(
    terminalSnapshots.flatMap((snapshot) =>
      snapshot.projectId === projectId
        ? [closeTerminal({ sessionId: snapshot.sessionId, deleteHistory: true })]
        : [],
    ),
  )
}

async function disposeWorkspaceSessions(projectId: string) {
  const sessionPaths = listProjectSessionPaths(projectId)
  await disposeWorkspaceComposerRuns({ projectPath: projectId, sessionPaths })
  for (const sessionPath of sessionPaths) {
    setThreadRunningState(sessionPath, false)
  }
  await closeWorkspaceTerminals(projectId)
}

async function deletePersistedThreadsForWorkspace(threadIds: string[]) {
  const deleteResult = await deletePersistedThreads(threadIds)
  if (deleteResult.failedThreadIds.length === 0) return null
  return {
    didMutate: deleteResult.deletedThreadIds.length > 0,
    error: `Failed to delete ${deleteResult.failedThreadIds.length} thread(s).`,
    failedThreadIds: deleteResult.failedThreadIds,
  }
}

function isMissingBranchPruneError(result: Awaited<ReturnType<typeof pruneProjectBranch>>) {
  if (!('error' in result)) return false
  const normalizedError = String(result.error).toLowerCase()
  return normalizedError.includes('branch') && normalizedError.includes('not found')
}

async function handleCommitWorkspaceAction(payload: AnyDesktopActionPayload) {
  const projectId = getProjectId(payload)
  if (!projectId) return handledAction()

  return handledAction(
    await commitProjectChanges(projectId, {
      includeUnstaged: getGitIncludeUnstaged(payload),
      includeUntracked: getGitIncludeUntracked(payload),
      message: getGitCommitMessage(payload),
      preview: getGitPreview(payload),
      push: getGitPush(payload),
      // AI commit messages are intentionally wired here: when Git Ops sends no explicit
      // message, commitProjectChanges calls this generator before falling back to defaults.
      generateMessage: (context) => generateGitCommitMessage(getComposerRequest(payload), context),
    }),
  )
}

async function handleCommitOptionsWorkspaceAction(payload: AnyDesktopActionPayload) {
  const projectId = getProjectId(payload)
  if (!projectId) return handledAction()

  const repoUrl = getGitRepoUrl(payload)
  const gitOpsMode = getGitOpsMode(payload)

  if (gitOpsMode === 'invalid') return handledAction({ error: 'Invalid GitOps mode.' })
  if (gitOpsMode !== undefined && repoUrl) {
    return handledAction({ error: 'GitOps mode and repository URL must be saved separately.' })
  }
  if (gitOpsMode !== undefined) {
    setProjectGitOpsMode(projectId, gitOpsMode)
    return handledAction()
  }
  if (repoUrl) {
    await setProjectOrigin(projectId, repoUrl)
    setProjectRepoOrigin(projectId, repoUrl)
    return handledAction()
  }

  await initializeProjectGit(projectId)
  setProjectRepoOrigin(projectId, null)
  return handledAction()
}

function handleDiffPreferencesWorkspaceAction(payload: AnyDesktopActionPayload) {
  const sessionPath = getPersistedSessionPath(
    typeof payload.sessionPath === 'string' ? payload.sessionPath : null,
  )
  if (!sessionPath) {
    return handledAction({ error: 'Diff preferences can only be saved for persisted sessions.' })
  }

  const baseline = getProjectDiffBaselinePreference(payload)
  const renderMode = getProjectDiffRenderModePreference(payload)
  if (baseline === 'invalid') return handledAction({ error: 'Invalid diff baseline.' })
  if (renderMode === 'invalid') return handledAction({ error: 'Invalid diff render mode.' })

  const saved = setThreadDiffPreferences(sessionPath, {
    ...(baseline === undefined ? {} : { baseline }),
    ...(renderMode === undefined ? {} : { renderMode }),
  })
  return saved
    ? handledAction()
    : handledAction({ error: 'Could not save diff preferences for this session.' })
}

async function handleCreateWorktreeWorkspaceAction(payload: AnyDesktopActionPayload) {
  const projectId = getProjectId(payload)
  const branchName = getBranchName(payload)
  const parentBranchName = getParentBranchName(payload)
  if (!(projectId && branchName)) return handledAction({ error: 'Branch name is required.' })

  const rootProjectId = await getMainWorktreePath(projectId)
  const worktreeDirectory =
    getWorktreeDirectory(payload) ?? getProjectWorktreeDirectory(rootProjectId)
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
    projectId: result.projectId,
    rootProjectId: result.rootProjectId,
  })
}

function handleSetWorktreeDirectoryWorkspaceAction(payload: AnyDesktopActionPayload) {
  const projectId = getProjectId(payload)
  const worktreeDirectory = getWorktreeDirectory(payload)
  if (!(projectId && worktreeDirectory)) {
    return handledAction({ error: 'Worktree directory is required.' })
  }

  setProjectWorktreeDirectory(projectId, worktreeDirectory)
  return handledAction({ didMutate: true, rootProjectId: projectId })
}

function handleMarkWorktreeCompleteWorkspaceAction(payload: AnyDesktopActionPayload) {
  const projectId = getProjectId(payload)
  const worktreePath = getWorktreePath(payload)
  if (!(projectId && worktreePath)) return handledAction({ error: 'Worktree path is required.' })

  setProjectWorktreeCompleted(worktreePath, true)
  return handledAction({ didMutate: true, rootProjectId: projectId, projectId: worktreePath })
}

function handleMarkWorktreeIncompleteWorkspaceAction(payload: AnyDesktopActionPayload) {
  const projectId = getProjectId(payload)
  const worktreePath = getWorktreePath(payload)
  if (!(projectId && worktreePath)) return handledAction({ error: 'Worktree path is required.' })

  setProjectWorktreeCompleted(worktreePath, false)
  return handledAction({ didMutate: true, rootProjectId: projectId, projectId: worktreePath })
}

async function handleMergeWorktreeWorkspaceAction(payload: AnyDesktopActionPayload) {
  const projectId = getProjectId(payload)
  const worktreePath = getWorktreePath(payload)
  const branchName = getBranchName(payload)
  if (!(projectId && worktreePath && branchName)) {
    return handledAction({ error: 'Worktree branch is required.' })
  }
  await disposeWorkspaceSessions(worktreePath)

  const mergeResult = await mergeProjectBranch(projectId, branchName)
  if ('error' in mergeResult) return handledAction(mergeResult)

  setProjectWorktreeCompleted(worktreePath, true)
  const threadIds = listProjectThreadIds(worktreePath)
  const removeResult = await removeProjectWorktree(projectId, worktreePath)
  if ('error' in removeResult) {
    return handledAction({
      ...removeResult,
      didMutate: true,
      projectId: worktreePath,
      rootProjectId: projectId,
    })
  }

  const [branchResult, cleanupError] = await Promise.all([
    pruneProjectBranch(projectId, branchName),
    deletePersistedThreadsForWorkspace(threadIds),
  ])
  if (!cleanupError) deleteProject(worktreePath)
  if (branchResult && 'error' in branchResult) {
    return handledAction({ didMutate: true, error: branchResult.error })
  }
  if (cleanupError) {
    return handledAction({
      ...cleanupError,
      didMutate: true,
      projectId: worktreePath,
      rootProjectId: projectId,
    })
  }

  return handledAction({ didMutate: true, projectId: worktreePath, rootProjectId: projectId })
}

async function cleanupWorktree(input: {
  projectId: string
  worktreePath: string
  branchName: string | null
  merge: boolean
}) {
  await disposeWorkspaceSessions(input.worktreePath)

  if (input.merge) {
    if (!input.branchName) return { error: 'Worktree branch is required.' }
    const mergeResult = await mergeProjectBranch(input.projectId, input.branchName)
    if ('error' in mergeResult) return mergeResult
    setProjectWorktreeCompleted(input.worktreePath, true)
  }

  const threadIds = listProjectThreadIds(input.worktreePath)
  const removeResult = await removeProjectWorktree(input.projectId, input.worktreePath)
  if ('error' in removeResult) {
    return {
      ...removeResult,
      didMutate: true,
      projectId: input.worktreePath,
      rootProjectId: input.projectId,
    }
  }

  const branchResult = input.branchName
    ? await pruneProjectBranch(input.projectId, input.branchName)
    : null
  const cleanupError = await deletePersistedThreadsForWorkspace(threadIds)
  if (!cleanupError) deleteProject(input.worktreePath)
  if (branchResult && 'error' in branchResult) return { didMutate: true, error: branchResult.error }
  if (cleanupError) {
    return {
      ...cleanupError,
      didMutate: true,
      projectId: input.worktreePath,
      rootProjectId: input.projectId,
    }
  }

  return { didMutate: true }
}

async function handleCompletedWorktreesWorkspaceAction(
  payload: AnyDesktopActionPayload,
  options: { merge: boolean },
) {
  const projectId = getProjectId(payload)
  const worktrees = getWorktreeActionTargets(payload)
  if (!projectId) return handledAction({ error: 'Project is required.' })
  if (worktrees.length === 0) return handledAction({ error: 'No completed worktrees selected.' })

  let didMutate = false
  for (const worktree of worktrees) {
    const result = await cleanupWorktree({
      projectId,
      worktreePath: worktree.worktreePath,
      branchName: worktree.branchName,
      merge: options.merge,
    })
    didMutate = didMutate || result.didMutate === true
    if ('error' in result) {
      return handledAction({
        ...result,
        didMutate,
        failedWorktreeBranchName: worktree.branchName,
        failedWorktreePath: worktree.worktreePath,
      })
    }
  }

  return handledAction({ didMutate: true, rootProjectId: projectId })
}

async function handleRemoveWorktreeWorkspaceAction(payload: AnyDesktopActionPayload) {
  const projectId = getProjectId(payload)
  const worktreePath = getWorktreePath(payload)
  const branchName = getBranchName(payload)
  if (!(projectId && worktreePath)) return handledAction({ error: 'Worktree path is required.' })
  await disposeWorkspaceSessions(worktreePath)

  const threadIds = listProjectThreadIds(worktreePath)
  const removeResult = await removeProjectWorktree(projectId, worktreePath)
  if ('error' in removeResult) return handledAction(removeResult)

  const branchResult = branchName ? await pruneProjectBranch(projectId, branchName) : null
  const cleanupError = await deletePersistedThreadsForWorkspace(threadIds)
  if (!cleanupError) deleteProject(worktreePath)
  if (branchResult && 'error' in branchResult) {
    return handledAction({
      didMutate: true,
      error: cleanupError?.error
        ? `${branchResult.error} ${cleanupError.error}`
        : branchResult.error,
    })
  }
  if (cleanupError) {
    return handledAction({
      ...cleanupError,
      didMutate: true,
      projectId: worktreePath,
      rootProjectId: projectId,
    })
  }

  return handledAction(removeResult)
}

async function handlePruneBranchWorkspaceAction(payload: AnyDesktopActionPayload) {
  const projectId = getProjectId(payload)
  const branchName = getBranchName(payload)
  if (!(projectId && branchName)) return handledAction()
  if (hasRunningProjectThread(projectId)) {
    return handledAction({ error: 'Stop running sessions before pruning this branch.' })
  }
  let didMutate = false
  for (const worktree of getWorktreeActionTargets(payload)) {
    const result = await cleanupWorktree({
      projectId,
      worktreePath: worktree.worktreePath,
      branchName: null,
      merge: false,
    })
    didMutate = didMutate || result.didMutate === true
    if ('error' in result) {
      return handledAction({
        ...result,
        didMutate,
        failedWorktreeBranchName: worktree.branchName,
        failedWorktreePath: worktree.worktreePath,
      })
    }
  }
  const threadIds = listProjectFamilyBranchThreadIds(projectId, branchName)
  const result = await pruneProjectBranch(projectId, branchName)
  didMutate = didMutate || result.didMutate === true
  if (!('error' in result) || isMissingBranchPruneError(result)) {
    const cleanupError = await deletePersistedThreadsForWorkspace(threadIds)
    if (cleanupError) return handledAction({ ...cleanupError, didMutate: true })
  }
  if (isMissingBranchPruneError(result)) return handledAction({ didMutate: true })
  return handledAction('error' in result ? { ...result, didMutate } : result)
}

export async function handleWorkspaceDesktopAction(
  action: DesktopAction,
  payload: AnyDesktopActionPayload,
): Promise<ActionHandlerResult> {
  switch (action) {
    case 'workspace.commit':
      return handleCommitWorkspaceAction(payload)
    case 'workspace.commit-options':
      return handleCommitOptionsWorkspaceAction(payload)
    case 'workspace.diff-preferences':
      return handleDiffPreferencesWorkspaceAction(payload)
    case 'workspace.sidebar-scope':
      setSidebarVisibleProjectIds(getProjectIds(payload))
      return handledAction()
    case 'workspace.switch-branch': {
      const projectId = getProjectId(payload)
      if (!projectId) return handledAction()
      return handledAction(await switchProjectBranch(projectId, String(payload.value ?? '')))
    }
    case 'workspace.prune-branch': {
      return handlePruneBranchWorkspaceAction(payload)
    }
    case 'workspace.create-worktree':
      return handleCreateWorktreeWorkspaceAction(payload)
    case 'workspace.remove-worktree':
      return handleRemoveWorktreeWorkspaceAction(payload)
    case 'workspace.mark-worktree-complete':
      return handleMarkWorktreeCompleteWorkspaceAction(payload)
    case 'workspace.mark-worktree-incomplete':
      return handleMarkWorktreeIncompleteWorkspaceAction(payload)
    case 'workspace.merge-worktree':
      return handleMergeWorktreeWorkspaceAction(payload)
    case 'workspace.merge-completed-worktrees':
      return handleCompletedWorktreesWorkspaceAction(payload, { merge: true })
    case 'workspace.remove-completed-worktrees':
      return handleCompletedWorktreesWorkspaceAction(payload, { merge: false })
    case 'workspace.set-worktree-directory':
      return handleSetWorktreeDirectoryWorkspaceAction(payload)

    default:
      return unhandledAction()
  }
}
