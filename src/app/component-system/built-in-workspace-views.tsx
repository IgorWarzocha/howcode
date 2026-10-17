import { workingDirectoriesComponent } from '@howcode/components/working-directories/ui/component'
import type { ComponentProps } from 'react'
import type { AppShellController } from '../app-shell/useAppShellController'
import { FALLBACK_APP_SETTINGS } from '../workspace-shell/default-app-settings'
import { UtilityWorkspaceView } from '../workspace-shell/utility-workspace-view'
import { InstalledNavigationHistory } from './navigation-history'
import { ChatWorkspaceView } from './workspace-presentation/chat-workspace-view'
import type { WorkspaceViewContributions } from './workspace-views'

type ChatProps = ComponentProps<typeof ChatWorkspaceView>

export type BuiltInWorkspaceViewProps = ChatProps & {
  controller: AppShellController
}

// Trusted built-in presentation composition does not select Durable extensions.
export function composeBuiltInWorkspaceViews(props: BuiltInWorkspaceViewProps) {
  const { controller } = props
  const chat = (
    <ChatWorkspaceView
      {...props}
      controller={{
        workspaces: controller.workspaces,
        composer: controller.composer,
        desktop: controller.desktop,
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
    Object.fromEntries(workingDirectoriesComponent.views.map((view) => [view, chat])),
  )
  return contributions
}
