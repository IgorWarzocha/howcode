import { ChatWorkspaceView } from '@howcode/chat-workspace'
import { workingDirectoriesComponent } from '@howcode/components/working-directories/ui/component'
import type { ComponentProps } from 'react'
import type { AppShellController } from '../app-shell/useAppShellController'
import { FALLBACK_APP_SETTINGS } from '../workspace-shell/default-app-settings'
import { UtilityWorkspaceView } from '../workspace-shell/utility-workspace-view'
import { InstalledNavigationHistory } from './navigation-history'
import { DomainWorkspaceView } from './workspace-presentation/domain-workspace-view'
import type { WorkspaceViewContributions } from './workspace-views'

type CodeProps = ComponentProps<typeof DomainWorkspaceView>

export type BuiltInWorkspaceViewProps = CodeProps & {
  controller: AppShellController
}

// Trusted built-in presentation composition does not select Durable extensions.
export function composeBuiltInWorkspaceViews(props: BuiltInWorkspaceViewProps) {
  const { controller } = props
  const chat = (
    <ChatWorkspaceView
      artifactDrawer={props.artifactDrawer}
      controller={{
        workspaces: controller.workspaces,
        composer: controller.composer,
        desktop: controller.desktop,
        navigation: controller.navigation,
        terminal: controller.terminal,
        chat: controller.chat,
        workspace: controller.workspace,
      }}
      activeComposerState={props.activeComposerState}
      activeChatData={props.activeChatData}
      composerDirectoryId={props.composerDirectoryId}
      terminalConversationId={props.terminalConversationId}
      sidebarCollapsed={props.sidebarCollapsed}
      sidebarAutoHidden={props.sidebarAutoHidden}
      sidebarCompactMode={props.sidebarCompactMode}
      onToggleSidebar={props.onToggleSidebar}
    />
  )
  const code = (
    <DomainWorkspaceView
      {...props}
      controller={{
        composer: controller.composer,
        desktop: controller.desktop,
        gitOps: controller.gitOps,
        navigation: controller.navigation,
        directories: controller.directories,
        terminal: controller.terminal,
        chat: controller.chat,
        workspace: controller.workspace,
      }}
    />
  )

  const settings = controller.desktop.shellState?.appSettings
  const utility = (
    <UtilityWorkspaceView {...props} appSettings={settings ?? FALLBACK_APP_SETTINGS} />
  )
  const contributions: WorkspaceViewContributions = {
    inbox: utility,
    archived: utility,
    settings: utility,
    chat,
    workspace: chat,
    history: <InstalledNavigationHistory controller={controller} />,
  }
  Object.assign(
    contributions,
    Object.fromEntries(workingDirectoriesComponent.views.map((view) => [view, code])),
  )
  if (controller.workspace.state.composerProfile === 'coding') {
    Object.assign(contributions, { chat: code, workspace: code })
  }
  return contributions
}
