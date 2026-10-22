import { DirectoryOverviewView, LandingView } from '@howcode/components/working-directories/ui'
import type {
  AppSettings,
  ChatData,
  DesktopActionInvoker,
  DirectoryGitState,
} from '../../desktop/types'
import type { View, WorkingDirectory } from '../../types'
import { InstalledChatRenderer } from '../chat-renderer-slot'

type ChatWorkspaceMainViewProps = {
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

function ChatMainView({
  composerLayoutVersion,
  composerOverlayHeight,
  onLoadEarlierMessages,
  chatData,
  chatLoading,
}: Pick<
  ChatWorkspaceMainViewProps,
  | 'composerLayoutVersion'
  | 'composerOverlayHeight'
  | 'onLoadEarlierMessages'
  | 'chatData'
  | 'chatLoading'
>) {
  return (
    <InstalledChatRenderer
      key={chatData?.conversationId ?? 'new-thread'}
      messages={chatData?.messages ?? []}
      previousMessageCount={chatData?.previousMessageCount ?? 0}
      isStreaming={chatData?.isStreaming ?? false}
      {...(chatData?.hostObservedAtMs === undefined
        ? {}
        : { hostObservedAtMs: chatData.hostObservedAtMs })}
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

function ChatWorkspaceDirectoryOrEmptyView({
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
  ChatWorkspaceMainViewProps,
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
        />
      ) : null}
    </div>
  )
}

export function ChatWorkspaceMainView({
  activeView,
  appSettings,
  currentDirectoryName,
  directories,
  selectedDirectoryId,
  workspaceContentClass,
  chatData,
  chatLoading = false,
  composerLayoutVersion,
  composerOverlayHeight,
  onAction,
  onOpenChat,
  onLoadEarlierMessages,
  onSelectDirectory,
}: ChatWorkspaceMainViewProps) {
  if (activeView === 'chat' || activeView === 'workspace') {
    return (
      <ChatMainView
        composerLayoutVersion={composerLayoutVersion}
        composerOverlayHeight={composerOverlayHeight}
        chatData={chatData}
        chatLoading={chatLoading}
        onLoadEarlierMessages={onLoadEarlierMessages}
      />
    )
  }

  return (
    <ChatWorkspaceDirectoryOrEmptyView
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
