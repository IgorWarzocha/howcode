import type { GitPresentation } from '@howaboua/howcode-sdk/git-renderer'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type {
  ChatData,
  ComposerFilePickerState,
  ComposerState,
  DesktopActionInvoker,
  DirectoryGitState,
  ShellState,
} from '../../desktop/types'
import type { SettingsOpenTarget } from '../../settings/settings/settingsTypes'
import type { WorkspaceState } from '../../state/workspace-model'
import type { View, WorkingDirectory } from '../../types'
import type { WorkspaceArtifactDrawerState } from '../../workspace-shell/useWorkspaceArtifactDrawerState'

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
    showView: (view: View, target?: SettingsOpenTarget) => void
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
  artifactDrawer: WorkspaceArtifactDrawerState
  controller: DomainWorkspaceController
  activeComposerState: ComposerState | null
  activeChatData: ChatData | null
  composerDirectoryId: string
  currentDirectoryName: string
  terminalDrawerVisible: boolean
  terminalDrawerOverlay?: boolean
  terminalConversationId: string | null
  workspaceContentClass: string
  sidebarCollapsed: boolean
  sidebarAutoHidden: boolean
  sidebarCompactMode: boolean
  onToggleSidebar: () => void
}

export type DomainWorkspaceContentProps = DomainWorkspaceViewProps & {
  footerRef: RefObject<HTMLElement | null>
  mainViewRef: RefObject<HTMLElement | null>
  terminalDrawerInsetStyle: { right: string } | undefined
  footerInset: number
  chatFooterStyle: { top?: string; bottom?: number } | undefined
  showWorkspaceFooter: boolean
  showChatFooter: boolean
  showCodeSidebarFooter: boolean
  gitDetailOpen: boolean
  gitPresentation: GitPresentation | null
  showDesktopTerminalDrawer: boolean
  centerChatFooter: boolean
  chatTimelineLoading: boolean
  composerLayoutVersion: number
  setComposerLayoutVersion: Dispatch<SetStateAction<number>>
  composerOverlayHeight: number
  setComposerOverlayHeight: Dispatch<SetStateAction<number>>
  handleAction: DesktopActionInvoker
  handleLoadEarlierMessages: () => void
  handleToggleTerminal: () => void
  listComposerAttachmentEntries: DomainWorkspaceController['composer']['listAttachmentEntries']
  shellState: ShellState | null
  state: WorkspaceState
  directoryGitState: DirectoryGitState | null
  parentBranchName: string | null
}
