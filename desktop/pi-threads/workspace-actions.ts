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
  getProjectDiffBaselinePreference,
  getProjectDiffRenderModePreference,
  getProjectId,
  getProjectIds,
  getWorktreeDirectory,
  getWorktreePath,
} from '../../shared/pi-thread-action-payloads.ts'
import { getPersistedSessionPath } from '../../shared/session-paths.ts'
import { setSidebarVisibleProjectIds } from '../app-settings/writers.ts'
import { generateGitCommitMessage } from '../git-commit-message.ts'
import {
  commitProjectChanges,
  createProjectWorktree,
  getMainWorktreePath,
  initializeProjectGit,
  pruneProjectBranch,
  removeProjectWorktree,
  setProjectOrigin,
  switchProjectBranch,
} from '../project-git.ts'
import {
  ensureProject,
  getProjectWorktreeDirectory,
  hasRunningProjectThread,
  setProjectGitOpsMode,
  setProjectRepoOrigin,
  setProjectWorktreeDirectory,
  setThreadDiffPreferences,
  upsertProjectWorktree,
} from '../thread-state-db.ts'
import type { ActionHandlerResult } from './action-router-result.ts'
import { handledAction, unhandledAction } from './action-router-result.ts'

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
    isMain: false,
    source: 'howcode',
  })

  return handledAction({
    didMutate: true,
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
      const projectId = getProjectId(payload)
      const branchName = getBranchName(payload)
      if (!(projectId && branchName)) return handledAction()
      if (hasRunningProjectThread(projectId)) {
        return handledAction({ error: 'Stop running sessions before pruning this branch.' })
      }
      return handledAction(await pruneProjectBranch(projectId, branchName))
    }
    case 'workspace.create-worktree':
      return handleCreateWorktreeWorkspaceAction(payload)
    case 'workspace.remove-worktree': {
      const projectId = getProjectId(payload)
      const worktreePath = getWorktreePath(payload)
      if (!(projectId && worktreePath))
        return handledAction({ error: 'Worktree path is required.' })
      return handledAction(await removeProjectWorktree(projectId, worktreePath))
    }
    case 'workspace.set-worktree-directory':
      return handleSetWorktreeDirectoryWorkspaceAction(payload)

    default:
      return unhandledAction()
  }
}
