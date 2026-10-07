import type { ActionHandlerResult } from '../../../../desktop/app-service/action-router-result.ts'
import {
  handledAction,
  unhandledAction,
} from '../../../../desktop/app-service/action-router-result.ts'
import { setSidebarVisibleProjectIds } from '../../../../desktop/app-settings/writers.ts'
import { setThreadDiffPreferences } from '../../../../desktop/thread-state-db.ts'
import { getPersistedConversationId } from '../../../../shared/conversation-ids.ts'
import {
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
} from '../../../../shared/desktop-action-payloads.ts'
import type { DesktopAction } from '../../../../shared/desktop-actions.ts'
import type { AnyDesktopActionPayload } from '../../../../shared/desktop-contracts.ts'
import { generateGitCommitMessage } from '../git-commit-message.ts'
import {
  commitProjectChanges,
  getMainWorktreePath,
  initializeProjectGit,
  setProjectOrigin,
  switchProjectBranch,
} from '../project-git.ts'
import { withRootGitMutation } from '../project-worktrees/root-git-mutation-gate.ts'
import { setProjectGitOpsMode, setProjectRepoOrigin } from '../state.ts'
import { handleWriteFileWorkspaceAction } from './workspace-file-actions.ts'

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
  const conversationId = getPersistedConversationId(
    typeof payload.conversationId === 'string' ? payload.conversationId : null,
  )
  if (!conversationId) {
    return handledAction({ error: 'Diff preferences can only be saved for persisted sessions.' })
  }

  const baseline = getProjectDiffBaselinePreference(payload)
  const renderMode = getProjectDiffRenderModePreference(payload)
  if (baseline === 'invalid') return handledAction({ error: 'Invalid diff baseline.' })
  if (renderMode === 'invalid') return handledAction({ error: 'Invalid diff render mode.' })

  const saved = setThreadDiffPreferences(conversationId, {
    ...(baseline === undefined ? {} : { baseline }),
    ...(renderMode === undefined ? {} : { renderMode }),
  })
  return saved
    ? handledAction()
    : handledAction({ error: 'Could not save diff preferences for this session.' })
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
    case 'workspace.write-file':
      return handleWriteFileWorkspaceAction(payload)
    case 'workspace.sidebar-scope':
      setSidebarVisibleProjectIds(getProjectIds(payload))
      return handledAction()
    case 'workspace.switch-branch': {
      const projectId = getProjectId(payload)
      if (!projectId) return handledAction()
      const rootProjectId = await getMainWorktreePath(projectId)
      return handledAction(
        await withRootGitMutation(rootProjectId, () =>
          switchProjectBranch(projectId, String(payload.value ?? '')),
        ),
      )
    }
    default:
      return unhandledAction()
  }
}
