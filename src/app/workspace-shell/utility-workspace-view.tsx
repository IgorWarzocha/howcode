import { ArchivedThreadsView } from '@howcode/archive'
import { InboxView } from '@howcode/inbox'
import { defaultPiSettings } from '@howcode/shared/default-pi-settings'
import type { AppShellController } from '../app-shell/useAppShellController'
import type { AppSettings, ComposerState } from '../desktop/types'
import { SettingsView } from '../settings/settings-view'
import { HostWorkspacePresentation } from './host-workspace-presentation'

type UtilityWorkspaceViewProps = {
  controller: Pick<
    AppShellController,
    'desktop' | 'workspace' | 'thread' | 'composer' | 'inbox' | 'navigation' | 'settings'
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
    <HostWorkspacePresentation flush={view === 'inbox'}>
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
        <ArchivedThreadsView threads={controller.thread.archived} onAction={handleAction} />
      ) : null}
    </HostWorkspacePresentation>
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
      key={controller.inbox.selectedThread?.conversationId ?? 'inbox-empty'}
      appSettings={appSettings}
      availableModels={activeComposerState?.availableModels ?? []}
      availableThinkingLevels={activeComposerState?.availableThinkingLevels ?? ['off']}
      contextUsage={activeComposerState?.contextUsage ?? null}
      currentModel={activeComposerState?.currentModel ?? null}
      currentThinkingLevel={activeComposerState?.currentThinkingLevel ?? 'off'}
      isCompacting={activeComposerState?.isCompacting ?? false}
      thread={controller.inbox.selectedThread}
      onAction={handleAction}
      onDismissThread={controller.inbox.dismiss}
      onListAttachmentEntries={controller.composer.listAttachmentEntries}
      onOpenThread={controller.thread.open}
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
