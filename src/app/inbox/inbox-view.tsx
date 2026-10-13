import type { SettingsOpenTarget } from '@howcode/settings/settingsTypes'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { getInboxChatComposerProfile } from '../common/inbox-chat-scope'
import { InstalledInboxComposer as InboxComposer } from '../component-system/composer-renderer-slot'
import type {
  AppSettings,
  ComposerContextUsage,
  ComposerFilePickerState,
  ComposerModel,
  ComposerThinkingLevel,
  DesktopActionInvoker,
  InboxChat,
} from '../desktop/types'
import { WorkspaceComposerDock } from '../workspace-shell/workspace-composer-dock'
import { InboxChatHeader, InboxChatMessage, InboxEmptyState } from './inbox-chat-content'

type InboxViewProps = {
  appSettings: AppSettings
  availableModels: ComposerModel[]
  availableThinkingLevels: ComposerThinkingLevel[]
  contextUsage: ComposerContextUsage | null
  currentModel: ComposerModel | null
  currentThinkingLevel: ComposerThinkingLevel
  isCompacting: boolean
  chat: InboxChat | null
  onAction: DesktopActionInvoker
  onDismissChat: (chat: InboxChat) => void
  onListAttachmentEntries: (request: {
    directoryId?: string | null
    path?: string | null
    rootPath?: string | null
  }) => Promise<ComposerFilePickerState | null>
  onOpenChat: (
    directoryId: string,
    chatId: string,
    conversationId: string,
    composerProfile?: 'general' | 'coding' | undefined,
    branchName?: string | null | undefined,
  ) => void
  onOpenSettingsView: (target?: SettingsOpenTarget) => void
  sidebarCollapsed: boolean
  sidebarCompactMode: boolean
  onToggleSidebar: () => void
}

type InboxChatViewProps = Omit<InboxViewProps, 'chat'> & { chat: InboxChat }

function InboxSidebarToggle({
  sidebarCollapsed,
  sidebarCompactMode,
  onToggleSidebar,
}: {
  sidebarCollapsed: boolean
  sidebarCompactMode: boolean
  onToggleSidebar: () => void
}) {
  if (sidebarCompactMode && !sidebarCollapsed) return null
  const showSidebar = sidebarCollapsed || sidebarCompactMode
  return (
    <button
      type="button"
      className="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--muted)] opacity-70 transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] hover:opacity-100"
      onClick={onToggleSidebar}
      aria-label={showSidebar ? 'Show sidebar' : 'Hide sidebar'}
      data-tooltip={showSidebar ? 'Show sidebar' : 'Hide sidebar'}
      data-tooltip-placement="right"
    >
      {showSidebar ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
    </button>
  )
}

function InboxChatView({
  appSettings,
  availableModels,
  availableThinkingLevels,
  contextUsage,
  currentModel,
  currentThinkingLevel,
  isCompacting,
  chat,
  onAction,
  onDismissChat,
  onListAttachmentEntries,
  onOpenChat,
  onOpenSettingsView,
  sidebarCollapsed,
  sidebarCompactMode,
  onToggleSidebar,
}: InboxChatViewProps) {
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] pt-6 pb-4">
      <InboxChatHeader chat={chat} />
      <InboxChatMessage chat={chat} />

      <div>
        <WorkspaceComposerDock
          compactControls={sidebarCompactMode || sidebarCollapsed}
          left={
            <InboxSidebarToggle
              sidebarCollapsed={sidebarCollapsed}
              sidebarCompactMode={sidebarCompactMode}
              onToggleSidebar={onToggleSidebar}
            />
          }
          center={
            <InboxComposer
              appSettings={appSettings}
              isCompacting={isCompacting}
              modelState={{
                availableModels,
                availableThinkingLevels,
                contextUsage,
                currentModel,
                currentThinkingLevel,
              }}
              chat={chat}
              onAction={onAction}
              onDismiss={() => onDismissChat(chat)}
              onListAttachmentEntries={onListAttachmentEntries}
              onOpenChat={() =>
                onOpenChat(
                  chat.directoryId,
                  chat.chatId,
                  chat.conversationId,
                  getInboxChatComposerProfile(chat),
                  chat.branchName,
                )
              }
              onOpenSettingsView={onOpenSettingsView}
              onStartNewSession={() =>
                void onAction('chat.new', {
                  directoryId: chat.directoryId,
                  composerProfile: getInboxChatComposerProfile(chat),
                  branchName: chat.branchName,
                })
              }
            />
          }
        />
      </div>
    </div>
  )
}

export function InboxView(props: InboxViewProps) {
  if (!props.chat) return <InboxEmptyState />
  return <InboxChatView {...props} chat={props.chat} />
}
