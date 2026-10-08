import { useCallback, useState } from 'react'
import { useHowcodeKeybindingCommand } from '../../../../src/app/app-shell/keybinding-events'
import type {
  DesktopActionInvoker,
  DirectoryDiffBaseline,
  ShellState,
} from '../../../../src/app/desktop/types'
import { useGitOpsReviewController } from './useGitOpsReviewController'
import { useGitWorkspacePreferences } from './workspace-preferences'

export function useGitWorkspacePresentation({
  detailOpen,
  composerDirectoryId,
  terminalConversationId,
  shellState,
  diffBaseline,
  handleAction,
  handleOpenWorktreeDiffFile,
}: {
  detailOpen: boolean
  composerDirectoryId: string
  terminalConversationId: string | null
  shellState: ShellState | null
  diffBaseline: DirectoryDiffBaseline | null
  handleAction: DesktopActionInvoker
  handleOpenWorktreeDiffFile: (filePath: string) => void
}) {
  const {
    gitOpsFileTreeVisibilityByChat,
    setGitOpsFileTreeVisibilityByChat,
    includeUntrackedDiffFilesByChat,
    setIncludeUntrackedDiffFilesByChat,
  } = useGitWorkspacePreferences()
  const gitOpsFileTreeStateKey = `${composerDirectoryId}:${terminalConversationId ?? 'workspace'}`
  const gitOpsFileTreeVisible =
    gitOpsFileTreeVisibilityByChat[gitOpsFileTreeStateKey] ??
    shellState?.appSettings.gitDiffFileTreeDefaultVisible ??
    true

  const gitDiffIncludeUntrackedDefault =
    shellState?.appSettings.gitDiffIncludeUntrackedDefault ?? false
  const parentBranchName =
    shellState?.directories.find((directory) => directory.id === composerDirectoryId)?.worktree
      ?.parentBranchName ?? null
  const includeUntrackedDiffFiles =
    includeUntrackedDiffFilesByChat[gitOpsFileTreeStateKey] ?? gitDiffIncludeUntrackedDefault
  const toggleGitOpsFileTree = useCallback(() => {
    setGitOpsFileTreeVisibilityByChat((current) => ({
      ...current,
      [gitOpsFileTreeStateKey]: !(current[gitOpsFileTreeStateKey] ?? gitOpsFileTreeVisible),
    }))
  }, [gitOpsFileTreeStateKey, gitOpsFileTreeVisible, setGitOpsFileTreeVisibilityByChat])
  const toggleIncludeUntrackedDiffFiles = useCallback(() => {
    setIncludeUntrackedDiffFilesByChat((current) => ({
      ...current,
      [gitOpsFileTreeStateKey]: !(
        current[gitOpsFileTreeStateKey] ?? gitDiffIncludeUntrackedDefault
      ),
    }))
  }, [gitDiffIncludeUntrackedDefault, gitOpsFileTreeStateKey, setIncludeUntrackedDiffFilesByChat])
  useHowcodeKeybindingCommand('gitops.toggleChangedFiles', (event) => {
    if (!detailOpen) return
    event.preventDefault()
    toggleGitOpsFileTree()
  })
  const [diffLoadError, setDiffLoadError] = useState<string | null>(null)
  const gitOpsReview = useGitOpsReviewController({
    baseline: diffBaseline,
    composerDirectoryId,
    handleAction,
    handleOpenWorktreeDiffFile,
    shellState,
    includeUntracked: includeUntrackedDiffFiles,
  })
  return {
    gitOpsFileTreeVisible,
    parentBranchName,
    includeUntrackedDiffFiles,
    toggleGitOpsFileTree,
    toggleIncludeUntrackedDiffFiles,
    diffLoadError,
    setDiffLoadError,
    gitOpsReview,
  }
}
