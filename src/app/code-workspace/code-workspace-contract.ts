import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { AppShellController } from '../app-shell/useAppShellController'
import type { ProjectDiffBaseline, ProjectDiffRenderMode } from '../desktop/types'
import type { useGitOpsReviewController } from './useGitOpsReviewController'
import type { useQueuedPromptRestore } from './useQueuedPromptRestore'

export type CodeWorkspaceViewProps = {
  controller: AppShellController
  activeComposerState: AppShellController['activeComposerState']
  activePiExtensionUiState: AppShellController['activePiExtensionUiState']
  activeThreadData: AppShellController['activeThreadData']
  composerProjectId: string
  currentProjectName: string
  diffBaseline: ProjectDiffBaseline
  diffRenderMode: ProjectDiffRenderMode
  terminalDrawerVisible: boolean
  terminalDrawerOverlay?: boolean
  terminalSessionPath: string | null
  workspaceContentClass: string
  onSetDiffBaseline: (baseline: ProjectDiffBaseline) => void
  onSetDiffRenderMode: (renderMode: ProjectDiffRenderMode) => void
  sidebarCollapsed: boolean
  sidebarAutoHidden: boolean
  sidebarCompactMode: boolean
  onToggleSidebar: () => void
}

export type CodeWorkspaceContentProps = CodeWorkspaceViewProps &
  ReturnType<typeof useQueuedPromptRestore> & {
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
    handleAction: AppShellController['handleAction']
    handleLoadEarlierMessages: AppShellController['handleLoadEarlierMessages']
    handleCloseGitOpsView: AppShellController['handleCloseGitOpsView']
    handleOpenGitOpsView: AppShellController['handleOpenGitOpsView']
    handleShowTakeoverTerminal: AppShellController['handleShowTakeoverTerminal']
    handleToggleTerminal: AppShellController['handleToggleTerminal']
    listComposerAttachmentEntries: AppShellController['listComposerAttachmentEntries']
    shellState: AppShellController['shellState']
    state: AppShellController['state']
    projectGitState: AppShellController['projectGitState']
    parentBranchName: string | null
  }
