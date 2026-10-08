import type { GitOpsReviewController } from '@howcode/components/git/ui'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { useQueuedPromptCancellation } from '../../composer/useQueuedPromptCancellation'
import type {
  ChatData,
  ComposerFilePickerState,
  ComposerState,
  DesktopActionInvoker,
  DirectoryDiffBaseline,
  DirectoryDiffRenderMode,
  DirectoryGitState,
  ShellState,
} from '../../desktop/types'
import type { SettingsOpenTarget } from '../../settings/settings/settingsTypes'
import type { WorkspaceState } from '../../state/workspace-model'
import type { View, WorkingDirectory } from '../../types'

export type DomainWorkspaceController = {
  composer: {
    listAttachmentEntries: (request: {
      directoryId?: string | null
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
  directories: {
    gitLoading: boolean
    items: WorkingDirectory[]
    select: (directoryId: string) => void
    gitState: DirectoryGitState | null
  }
  terminal: { toggle: () => void }
  chat: {
    activeLoading: boolean
    open: (directoryId: string, chatId: string, conversationId: string) => void
    loadEarlierMessages: () => void
  }
  workspace: { state: WorkspaceState }
}

export type DomainWorkspaceViewProps = {
  controller: DomainWorkspaceController
  activeComposerState: ComposerState | null
  activeChatData: ChatData | null
  composerDirectoryId: string
  currentDirectoryName: string
  diffBaseline: DirectoryDiffBaseline
  diffRenderMode: DirectoryDiffRenderMode
  terminalDrawerVisible: boolean
  terminalDrawerOverlay?: boolean
  terminalConversationId: string | null
  workspaceContentClass: string
  onSetDiffBaseline: (baseline: DirectoryDiffBaseline) => void
  onSetDiffRenderMode: (renderMode: DirectoryDiffRenderMode) => void
  sidebarCollapsed: boolean
  sidebarAutoHidden: boolean
  sidebarCompactMode: boolean
  onToggleSidebar: () => void
}

export type DomainWorkspaceContentProps = DomainWorkspaceViewProps &
  ReturnType<typeof useQueuedPromptCancellation> & {
    gitOpsReview: GitOpsReviewController
    footerRef: RefObject<HTMLElement | null>
    mainViewRef: RefObject<HTMLElement | null>
    terminalDrawerInsetStyle: { right: string } | undefined
    footerInset: number
    chatFooterStyle: { right?: string; top?: string } | undefined
    showWorkspaceFooter: boolean
    showChatFooter: boolean
    showCodeSidebarFooter: boolean
    gitDetailOpen: boolean
    showDesktopTerminalDrawer: boolean
    centerChatFooter: boolean
    gitOpsFileTreeVisible: boolean
    includeUntrackedDiffFiles: boolean
    toggleGitOpsFileTree: () => void
    toggleIncludeUntrackedDiffFiles: () => void
    diffLoadError: string | null
    setDiffLoadError: Dispatch<SetStateAction<string | null>>
    chatTimelineLoading: boolean
    composerLayoutVersion: number
    setComposerLayoutVersion: Dispatch<SetStateAction<number>>
    composerOverlayHeight: number
    setComposerOverlayHeight: Dispatch<SetStateAction<number>>
    handleAction: DesktopActionInvoker
    handleLoadEarlierMessages: () => void
    handleCloseGitOpsView: () => void
    handleToggleTerminal: () => void
    listComposerAttachmentEntries: DomainWorkspaceController['composer']['listAttachmentEntries']
    shellState: ShellState | null
    state: WorkspaceState
    directoryGitState: DirectoryGitState | null
    parentBranchName: string | null
  }
