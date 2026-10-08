import { ChatView } from '@howcode/chat'
import type {
  AppSettings,
  ChatData,
  DesktopActionInvoker,
  DirectoryGitState,
} from '../../../../src/app/desktop/types'
import type { View, WorkingDirectory } from '../../../../src/app/types'
import { DirectoryChatHistoryView } from '../chat-history'
import { DirectoryOverviewView, LandingView } from '../directories/index'

type CodeWorkspaceMainViewProps = {
  activeView: View
  appSettings: AppSettings
  currentDirectoryName: string
  directories: WorkingDirectory[]
  directoryGitState: DirectoryGitState | null
  selectedDirectoryId: string
  workspaceContentClass: string
  chatData: ChatData | null
  chatLoading?: boolean
  composerLayoutVersion: number
  composerOverlayHeight: number
  onAction: DesktopActionInvoker
  onCloseUtilityView: () => void
  onOpenChat: (directoryId: string, chatId: string, conversationId: string) => void
  onLoadEarlierMessages: () => void
  onSelectDirectory: (directoryId: string) => void
}

function CodeChatMainView({
  composerLayoutVersion,
  composerOverlayHeight,
  onLoadEarlierMessages,
  chatData,
  chatLoading,
}: Pick<
  CodeWorkspaceMainViewProps,
  | 'composerLayoutVersion'
  | 'composerOverlayHeight'
  | 'onLoadEarlierMessages'
  | 'chatData'
  | 'chatLoading'
>) {
  return (
    <ChatView
      key={chatData?.conversationId ?? 'new-thread'}
      messages={chatData?.messages ?? []}
      previousMessageCount={chatData?.previousMessageCount ?? 0}
      isStreaming={chatData?.isStreaming ?? false}
      isCompacting={chatData?.isCompacting ?? false}
      composerLayoutVersion={composerLayoutVersion}
      composerOverlayHeight={composerOverlayHeight}
      conversationId={chatData?.conversationId ?? null}
      loading={chatLoading ?? false}
      onLoadEarlierMessages={onLoadEarlierMessages}
      onLoadAroundMessage={onLoadEarlierMessages}
    />
  )
}

function CodeWorkspaceDirectoryOrEmptyView({
  appSettings,
  composerOverlayHeight,
  currentDirectoryName,
  onAction,
  onOpenChat,
  onSelectDirectory,
  directories,
  selectedDirectoryId,
  workspaceContentClass,
}: Pick<
  CodeWorkspaceMainViewProps,
  | 'appSettings'
  | 'composerOverlayHeight'
  | 'currentDirectoryName'
  | 'onAction'
  | 'onOpenChat'
  | 'onSelectDirectory'
  | 'directories'
  | 'selectedDirectoryId'
  | 'workspaceContentClass'
>) {
  const selectedDirectory =
    directories.find((directory) => directory.id === selectedDirectoryId) ?? null
  const showDirectoryDashboard = Boolean(selectedDirectory && appSettings.directoryDashboardEnabled)
  const showLandingPage = !selectedDirectory

  return (
    <div
      className={`relative grid h-full min-h-0 w-full justify-items-center overflow-hidden ${selectedDirectoryId ? 'px-0' : 'px-4'}`}
    >
      {showLandingPage ? (
        <LandingView
          appSettings={appSettings}
          className={workspaceContentClass}
          directoryName={currentDirectoryName}
          directories={directories}
          selectedDirectoryId=""
          composerOverlayHeight={composerOverlayHeight}
          onAction={onAction}
          onOpenChat={onOpenChat}
          onSelectDirectory={onSelectDirectory}
        />
      ) : showDirectoryDashboard && selectedDirectory ? (
        <DirectoryOverviewView
          composerOverlayHeight={composerOverlayHeight}
          directory={selectedDirectory}
          onOpenChat={onOpenChat}
          onAction={onAction}
        />
      ) : null}
    </div>
  )
}

export function CodeWorkspaceMainView({
  activeView,
  appSettings,
  currentDirectoryName,
  directories,
  directoryGitState,
  selectedDirectoryId,
  workspaceContentClass,
  chatData,
  chatLoading = false,
  composerLayoutVersion,
  composerOverlayHeight,
  onAction,
  onCloseUtilityView,
  onOpenChat,
  onLoadEarlierMessages,
  onSelectDirectory,
}: CodeWorkspaceMainViewProps) {
  if (activeView === 'chat') {
    return (
      <CodeChatMainView
        composerLayoutVersion={composerLayoutVersion}
        composerOverlayHeight={composerOverlayHeight}
        chatData={chatData}
        chatLoading={chatLoading}
        onLoadEarlierMessages={onLoadEarlierMessages}
      />
    )
  }

  if (activeView === 'history') {
    const selectedDirectory =
      directories.find((directory) => directory.id === selectedDirectoryId) ?? null
    const currentBranch =
      directoryGitState?.directoryId === selectedDirectoryId && directoryGitState.isGitRepo
        ? directoryGitState.branch
        : null
    return (
      <DirectoryChatHistoryView
        currentBranch={currentBranch}
        directory={selectedDirectory}
        directories={directories}
        onAction={onAction}
        onClose={onCloseUtilityView}
        onOpenChat={onOpenChat}
      />
    )
  }

  return (
    <CodeWorkspaceDirectoryOrEmptyView
      appSettings={appSettings}
      composerOverlayHeight={composerOverlayHeight}
      currentDirectoryName={currentDirectoryName}
      onAction={onAction}
      onOpenChat={onOpenChat}
      onSelectDirectory={onSelectDirectory}
      directories={directories}
      selectedDirectoryId={selectedDirectoryId}
      workspaceContentClass={workspaceContentClass}
    />
  )
}
