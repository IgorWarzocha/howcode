import { MainView } from '@howcode/app-shell'
import { ChatWorkspaceView } from '@howcode/chat-workspace'
import { codingComponent } from '@howcode/components/coding/ui/component'
import { CodeWorkspaceView } from '@howcode/components/coding/ui/views'
import { SkillsWorkspaceView } from '@howcode/components/skills/ui'
import { skillsComponent } from '@howcode/components/skills/ui/component'
import { isToolkitComponentEnabled } from '@howcode/shared/toolkit-components'
import type { ComponentProps } from 'react'
import type { AppShellController } from '../app-shell/useAppShellController'
import { mainPanelClass } from '../ui/classes'
import { FALLBACK_APP_SETTINGS } from '../workspace-shell/default-app-settings'
import { UtilityWorkspaceView } from '../workspace-shell/utility-workspace-view'
import { WorkspacePresentation } from '../workspace-shell/workspace-presentation'
import type { WorkspaceViewContributions } from './workspace-views'

type CodeProps = ComponentProps<typeof CodeWorkspaceView>

export type BuiltInWorkspaceViewProps = CodeProps & {
  controller: AppShellController
}

function roadmapView(activeView: 'claw' | 'work' | 'automations', directoryName: string) {
  return (
    <div className="relative min-h-0 flex-1 px-5 pt-1.5">
      <main className={mainPanelClass}>
        <MainView activeView={activeView} directoryName={directoryName} />
      </main>
    </div>
  )
}

// Trusted built-in presentations only. This compatibility composition preserves
// existing routes; it neither loads user code nor selects Durable extensions.
export function composeBuiltInWorkspaceViews(props: BuiltInWorkspaceViewProps) {
  const { controller } = props
  const chat = (
    <ChatWorkspaceView
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
      diffBaseline={props.diffBaseline}
      diffRenderMode={props.diffRenderMode}
      terminalConversationId={props.terminalConversationId}
      onSetDiffBaseline={props.onSetDiffBaseline}
      onSetDiffRenderMode={props.onSetDiffRenderMode}
      sidebarCollapsed={props.sidebarCollapsed}
      sidebarAutoHidden={props.sidebarAutoHidden}
      sidebarCompactMode={props.sidebarCompactMode}
      onToggleSidebar={props.onToggleSidebar}
    />
  )
  const code = (
    <CodeWorkspaceView
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
    claw: roadmapView('claw', props.currentDirectoryName),
    work: roadmapView('work', props.currentDirectoryName),
    automations: roadmapView('automations', props.currentDirectoryName),
  }
  if (isToolkitComponentEnabled(settings, codingComponent.id)) {
    Object.assign(contributions, codingComponent.contribute(code))
    if (controller.workspace.state.composerProfile === 'coding') {
      Object.assign(contributions, { chat: code, workspace: code })
    }
  }
  if (isToolkitComponentEnabled(settings, skillsComponent.id)) {
    Object.assign(
      contributions,
      skillsComponent.contribute(
        <WorkspacePresentation>
          <SkillsWorkspaceView
            appSettings={settings ?? FALLBACK_APP_SETTINGS}
            directoryPath={
              controller.workspace.state.hasSelectedDirectory
                ? controller.workspace.state.selectedDirectoryId || null
                : null
            }
            onSetDirectoryScopeActive={controller.resourceScope.setSkillsActive}
            onDirectoryTargetSelected={() => controller.resourceScope.setSkillsActive(true)}
            onAction={controller.desktop.handleAction}
            onClose={controller.navigation.closeUtilityView}
          />
        </WorkspacePresentation>,
      ),
    )
  }
  return contributions
}
