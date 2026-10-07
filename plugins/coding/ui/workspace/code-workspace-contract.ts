import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { useQueuedPromptCancellation } from '../../../../src/app/composer/useQueuedPromptCancellation'
import type {
  ComposerFilePickerState,
  ComposerState,
  DesktopActionInvoker,
  ProjectDiffBaseline,
  ProjectDiffRenderMode,
  ProjectGitState,
  ShellState,
  ThreadData,
} from '../../../../src/app/desktop/types'
import type { SettingsOpenTarget } from '../../../../src/app/settings/settings/settingsTypes'
import type { WorkspaceState } from '../../../../src/app/state/workspace-model'
import type { Project, View } from '../../../../src/app/types'
import type { useGitOpsReviewController } from './useGitOpsReviewController'

export type CodeWorkspaceController = {
  composer: {
    listAttachmentEntries: (request: {
      projectId?: string | null
      path?: string | null
      rootPath?: string | null
    }) => Promise<ComposerFilePickerState | null>
  }
  desktop: { handleAction: DesktopActionInvoker; shellState: ShellState | null }
  gitOps: {
    close: () => void
    open: (options?: { filePath?: string | null }) => void
    openWorktreeFile: (filePath: string) => void
  }
  navigation: {
    closeUtilityView: () => void
    showView: (view: Exclude<View, 'gitops'>, target?: SettingsOpenTarget) => void
  }
  projects: {
    gitLoading: boolean
    items: Project[]
    select: (projectId: string) => void
    gitState: ProjectGitState | null
  }
  terminal: { toggle: () => void }
  thread: {
    activeLoading: boolean
    open: (projectId: string, threadId: string, conversationId: string) => void
    loadEarlierMessages: () => void
  }
  workspace: { state: WorkspaceState }
}

export type CodeWorkspaceViewProps = {
  controller: CodeWorkspaceController
  activeComposerState: ComposerState | null
  activeThreadData: ThreadData | null
  composerProjectId: string
  currentProjectName: string
  diffBaseline: ProjectDiffBaseline
  diffRenderMode: ProjectDiffRenderMode
  terminalDrawerVisible: boolean
  terminalDrawerOverlay?: boolean
  terminalConversationId: string | null
  workspaceContentClass: string
  onSetDiffBaseline: (baseline: ProjectDiffBaseline) => void
  onSetDiffRenderMode: (renderMode: ProjectDiffRenderMode) => void
  sidebarCollapsed: boolean
  sidebarAutoHidden: boolean
  sidebarCompactMode: boolean
  onToggleSidebar: () => void
}

export type CodeWorkspaceContentProps = CodeWorkspaceViewProps &
  ReturnType<typeof useQueuedPromptCancellation> & {
    gitOpsReview: ReturnType<typeof useGitOpsReviewController>
    footerRef: RefObject<HTMLElement | null>
    mainViewRef: RefObject<HTMLElement | null>
    terminalDrawerInsetStyle: { right: string } | undefined
    footerInset: number
    threadFooterStyle: { right?: string; top?: string } | undefined
    showWorkspaceFooter: boolean
    showThreadFooter: boolean
    showCodeSidebarFooter: boolean
    showDiffInMainView: boolean
    showDesktopTerminalDrawer: boolean
    centerThreadFooter: boolean
    gitOpsFileTreeVisible: boolean
    includeUntrackedDiffFiles: boolean
    toggleGitOpsFileTree: () => void
    toggleIncludeUntrackedDiffFiles: () => void
    diffLoadError: string | null
    setDiffLoadError: Dispatch<SetStateAction<string | null>>
    threadTimelineLoading: boolean
    composerLayoutVersion: number
    setComposerLayoutVersion: Dispatch<SetStateAction<number>>
    composerOverlayHeight: number
    setComposerOverlayHeight: Dispatch<SetStateAction<number>>
    handleAction: DesktopActionInvoker
    handleLoadEarlierMessages: () => void
    handleCloseGitOpsView: () => void
    handleOpenGitOpsView: CodeWorkspaceController['gitOps']['open']
    handleToggleTerminal: () => void
    listComposerAttachmentEntries: CodeWorkspaceController['composer']['listAttachmentEntries']
    shellState: ShellState | null
    state: WorkspaceState
    projectGitState: ProjectGitState | null
    parentBranchName: string | null
  }
