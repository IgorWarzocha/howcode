import { ArchivedChatsView } from '@howcode/archive'
import { InboxView } from '@howcode/inbox'
import { defaultPiSettings } from '@howcode/shared/default-pi-settings'
import type { AppShellController } from '../app-shell/useAppShellController'
import type { AppSettings, ComposerState } from '../desktop/types'
import { SettingsView } from '../settings/settings-view'
import { WorkspacePresentation } from './workspace-presentation'

type UtilityWorkspaceViewProps = {
  controller: Pick<
    AppShellController,
    'desktop' | 'workspace' | 'chat' | 'composer' | 'inbox' | 'navigation' | 'settings'
  >
  activeComposerState: ComposerState | null
  appSettings: AppSettings
  sidebarCollapsed: boolean
  sidebarCompactMode: boolean
  onToggleSidebar: () => void
}

export function UtilityWorkspaceView({
  controller,
  activeComposerState,
  appSettings,
  sidebarCollapsed,
  sidebarCompactMode,
  onToggleSidebar,
}: UtilityWorkspaceViewProps) {
  const { handleAction } = controller.desktop
  const view = controller.workspace.state.activeView
  return (
    <WorkspacePresentation flush={view === 'inbox'}>
      {view === 'inbox' ? (
        <InboxWorkspaceContent
          controller={controller}
          activeComposerState={activeComposerState}
          appSettings={appSettings}
          sidebarCollapsed={sidebarCollapsed}
          sidebarCompactMode={sidebarCompactMode}
          onToggleSidebar={onToggleSidebar}
        />
      ) : view === 'settings' ? (
        <SettingsWorkspaceContent
          controller={controller}
          activeComposerState={activeComposerState}
          appSettings={appSettings}
        />
      ) : view === 'archived' ? (
        <ArchivedChatsView chats={controller.chat.archived} onAction={handleAction} />
      ) : null}
    </WorkspacePresentation>
  )
}

function InboxWorkspaceContent({
  controller,
  activeComposerState,
  appSettings,
  sidebarCollapsed,
  sidebarCompactMode,
  onToggleSidebar,
}: UtilityWorkspaceViewProps) {
  const { handleAction } = controller.desktop
  return (
    <InboxView
      key={controller.inbox.selectedChat?.conversationId ?? 'inbox-empty'}
      appSettings={appSettings}
      availableModels={activeComposerState?.availableModels ?? []}
      availableThinkingLevels={activeComposerState?.availableThinkingLevels ?? ['off']}
      contextUsage={activeComposerState?.contextUsage ?? null}
      currentModel={activeComposerState?.currentModel ?? null}
      currentThinkingLevel={activeComposerState?.currentThinkingLevel ?? 'off'}
      isCompacting={activeComposerState?.isCompacting ?? false}
      chat={controller.inbox.selectedChat}
      onAction={handleAction}
      onDismissChat={controller.inbox.dismiss}
      onListAttachmentEntries={controller.composer.listAttachmentEntries}
      onOpenChat={controller.chat.open}
      onOpenSettingsView={(target) => controller.navigation.showView('settings', target)}
      sidebarCollapsed={sidebarCollapsed}
      sidebarCompactMode={sidebarCompactMode}
      onToggleSidebar={onToggleSidebar}
    />
  )
}

function SettingsWorkspaceContent({
  controller,
  activeComposerState,
  appSettings,
}: Pick<UtilityWorkspaceViewProps, 'controller' | 'activeComposerState' | 'appSettings'>) {
  const { shellState, handleAction } = controller.desktop
  return (
    <SettingsView
      appSettings={appSettings}
      piSettings={shellState?.piSettings ?? defaultPiSettings}
      piTheme={shellState?.piTheme ?? null}
      resolvedPiDirectory={shellState?.agentDir ?? null}
      availableModels={activeComposerState?.availableModels ?? []}
      availableThinkingLevels={activeComposerState?.availableThinkingLevels ?? ['off']}
      currentModel={activeComposerState?.currentModel ?? null}
      openTarget={controller.settings.openTarget}
      onAction={handleAction}
      onClose={controller.navigation.closeUtilityView}
    />
  )
}
