import type { ActionHandlerResult } from '../../../../desktop/app-service/action-router-result.ts'
import {
  handledAction,
  unhandledAction,
} from '../../../../desktop/app-service/action-router-result.ts'
import { setSidebarVisibleDirectoryIds } from '../../../../desktop/app-settings/writers.ts'
import { setChatDiffPreferences } from '../../../../desktop/chat-repository.ts'
import { getPersistedConversationId } from '../../../../shared/conversation-ids.ts'
import {
  getComposerRequest,
  getDirectoryDiffBaselinePreference,
  getDirectoryDiffRenderModePreference,
  getDirectoryId,
  getDirectoryIds,
  getGitCommitMessage,
  getGitIncludeUnstaged,
  getGitIncludeUntracked,
  getGitOpsMode,
  getGitPreview,
  getGitPush,
  getGitRepoUrl,
} from '../../../../shared/desktop-action-payloads.ts'
import type { DesktopAction } from '../../../../shared/desktop-actions.ts'
import type { AnyDesktopActionPayload } from '../../../../shared/desktop-contracts.ts'
import {
  commitDirectoryChanges,
  getMainWorktreePath,
  initializeDirectoryGit,
  setDirectoryOrigin,
  switchDirectoryBranch,
} from '../directory-git.ts'
import { withRootGitMutation } from '../directory-worktrees/root-git-mutation-gate.ts'
import { generateGitCommitMessage } from '../git-commit-message.ts'
import { setDirectoryGitOpsMode, setDirectoryRepoOrigin } from '../state.ts'
import { handleWriteFileWorkspaceAction } from './workspace-file-actions.ts'

async function handleCommitWorkspaceAction(payload: AnyDesktopActionPayload) {
  const directoryId = getDirectoryId(payload)
  if (!directoryId) return handledAction()

  return handledAction(
    await commitDirectoryChanges(directoryId, {
      includeUnstaged: getGitIncludeUnstaged(payload),
      includeUntracked: getGitIncludeUntracked(payload),
      message: getGitCommitMessage(payload),
      preview: getGitPreview(payload),
      push: getGitPush(payload),
      // AI commit messages are intentionally wired here: when Git Ops sends no explicit
      // message, commitDirectoryChanges calls this generator before falling back to defaults.
      generateMessage: (context) => generateGitCommitMessage(getComposerRequest(payload), context),
    }),
  )
}

async function handleCommitOptionsWorkspaceAction(payload: AnyDesktopActionPayload) {
  const directoryId = getDirectoryId(payload)
  if (!directoryId) return handledAction()

  const repoUrl = getGitRepoUrl(payload)
  const gitOpsMode = getGitOpsMode(payload)

  if (gitOpsMode === 'invalid') return handledAction({ error: 'Invalid GitOps mode.' })
  if (gitOpsMode !== undefined && repoUrl) {
    return handledAction({ error: 'GitOps mode and repository URL must be saved separately.' })
  }
  if (gitOpsMode !== undefined) {
    setDirectoryGitOpsMode(directoryId, gitOpsMode)
    return handledAction()
  }
  if (repoUrl) {
    await setDirectoryOrigin(directoryId, repoUrl)
    setDirectoryRepoOrigin(directoryId, repoUrl)
    return handledAction()
  }

  await initializeDirectoryGit(directoryId)
  setDirectoryRepoOrigin(directoryId, null)
  return handledAction()
}

function handleDiffPreferencesWorkspaceAction(payload: AnyDesktopActionPayload) {
  const conversationId = getPersistedConversationId(
    typeof payload.conversationId === 'string' ? payload.conversationId : null,
  )
  if (!conversationId) {
    return handledAction({ error: 'Diff preferences can only be saved for persisted sessions.' })
  }

  const baseline = getDirectoryDiffBaselinePreference(payload)
  const renderMode = getDirectoryDiffRenderModePreference(payload)
  if (baseline === 'invalid') return handledAction({ error: 'Invalid diff baseline.' })
  if (renderMode === 'invalid') return handledAction({ error: 'Invalid diff render mode.' })

  const saved = setChatDiffPreferences(conversationId, {
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
    case 'coding.commit':
      return handleCommitWorkspaceAction(payload)
    case 'coding.commit-options':
      return handleCommitOptionsWorkspaceAction(payload)
    case 'coding.diff-preferences':
      return handleDiffPreferencesWorkspaceAction(payload)
    case 'coding.write-file':
      return handleWriteFileWorkspaceAction(payload)
    case 'coding.sidebar-scope':
      setSidebarVisibleDirectoryIds(getDirectoryIds(payload))
      return handledAction()
    case 'coding.switch-branch': {
      const directoryId = getDirectoryId(payload)
      if (!directoryId) return handledAction()
      const rootDirectoryId = await getMainWorktreePath(directoryId)
      return handledAction(
        await withRootGitMutation(rootDirectoryId, () =>
          switchDirectoryBranch(directoryId, String(payload.value ?? '')),
        ),
      )
    }
    default:
      return unhandledAction()
  }
}
