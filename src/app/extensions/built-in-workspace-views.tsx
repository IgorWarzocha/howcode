import { MainView } from '@howcode/app-shell'
import { ChatWorkspaceView } from '@howcode/chat-workspace'
import { codingPlugin } from '@howcode/plugins/coding/ui/extension'
import { CodeWorkspaceView } from '@howcode/plugins/coding/ui/views'
import { SkillsWorkspaceView } from '@howcode/plugins/skills/ui'
import { isToolkitExtensionEnabled } from '@howcode/shared/toolkit-extensions'
import type { ComponentProps } from 'react'
import type { AppShellController } from '../app-shell/useAppShellController'
import { mainPanelClass } from '../ui/classes'
import { FALLBACK_APP_SETTINGS } from '../workspace-shell/default-app-settings'
import { HostWorkspacePresentation } from '../workspace-shell/host-workspace-presentation'
import { UtilityWorkspaceView } from '../workspace-shell/utility-workspace-view'
import type { WorkspaceViewContributions } from './workspace-views'

type CodeProps = ComponentProps<typeof CodeWorkspaceView>

export type BuiltInWorkspaceViewProps = CodeProps & {
  controller: AppShellController
}

function roadmapView(activeView: 'claw' | 'work' | 'automations', projectName: string) {
  return (
    <div className="relative min-h-0 flex-1 px-5 pt-1.5">
      <main className={mainPanelClass}>
        <MainView activeView={activeView} projectName={projectName} />
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
        chat: controller.chat,
        composer: controller.composer,
        desktop: controller.desktop,
        navigation: controller.navigation,
        terminal: controller.terminal,
        thread: controller.thread,
        workspace: controller.workspace,
      }}
      activeComposerState={props.activeComposerState}
      activeThreadData={props.activeThreadData}
      composerProjectId={props.composerProjectId}
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
        projects: controller.projects,
        terminal: controller.terminal,
        thread: controller.thread,
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
    claw: roadmapView('claw', props.currentProjectName),
    work: roadmapView('work', props.currentProjectName),
    automations: roadmapView('automations', props.currentProjectName),
  }
  if (isToolkitExtensionEnabled(settings, 'coding')) {
    Object.assign(contributions, codingPlugin.contribute(code))
  }
  if (isToolkitExtensionEnabled(settings, 'skills')) {
    Object.assign(contributions, {
      skills: (
        <HostWorkspacePresentation>
          <SkillsWorkspaceView
            appSettings={settings ?? FALLBACK_APP_SETTINGS}
            projectPath={
              controller.workspace.state.hasSelectedProject
                ? controller.workspace.state.selectedProjectId || null
                : null
            }
            onSetProjectScopeActive={controller.resourceScope.setSkillsActive}
            onProjectTargetSelected={() => controller.resourceScope.setSkillsActive(true)}
            onAction={controller.desktop.handleAction}
            onClose={controller.navigation.closeUtilityView}
          />
        </HostWorkspacePresentation>
      ),
    })
  }
  return contributions
}
