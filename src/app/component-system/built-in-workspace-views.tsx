import { MainView } from '@howcode/app-shell'
import { ChatWorkspaceView } from '@howcode/chat-workspace'
import { chatHistoryComponent } from '@howcode/components/chat-history/ui/component'
import { ChatHistoryWorkspaceView } from '@howcode/components/chat-history/ui/views'
import { SkillsWorkspaceView } from '@howcode/components/skills/ui'
import { skillsComponent } from '@howcode/components/skills/ui/component'
import { workingDirectoriesComponent } from '@howcode/components/working-directories/ui/component'
import { isToolkitComponentEnabled } from '@howcode/shared/toolkit-components'
import { mainPanelClass } from '@howcode/ui/classes'
import type { ComponentProps } from 'react'
import type { AppShellController } from '../app-shell/useAppShellController'
import { FALLBACK_APP_SETTINGS } from '../workspace-shell/default-app-settings'
import { UtilityWorkspaceView } from '../workspace-shell/utility-workspace-view'
import { WorkspacePresentation } from '../workspace-shell/workspace-presentation'
import { DomainWorkspaceView } from './workspace-presentation/domain-workspace-view'
import type { WorkspaceViewContributions } from './workspace-views'

type CodeProps = ComponentProps<typeof DomainWorkspaceView>

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

function composeChatHistory(controller: AppShellController) {
  const selectedDirectoryId = controller.workspace.state.hasSelectedDirectory
    ? controller.workspace.state.selectedDirectoryId
    : ''
  const directoryGitState = controller.directories.gitState
  return (
    <ChatHistoryWorkspaceView
      directory={
        controller.directories.items.find((directory) => directory.id === selectedDirectoryId) ??
        null
      }
      directories={controller.directories.items}
      currentBranch={
        directoryGitState?.directoryId === selectedDirectoryId && directoryGitState.isGitRepo
          ? directoryGitState.branch
          : null
      }
      onAction={controller.desktop.handleAction}
      onClose={controller.navigation.closeUtilityView}
      onOpenChat={controller.chat.open}
    />
  )
}

// Trusted built-in presentation composition does not select Durable extensions.
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
    claw: roadmapView('claw', props.currentDirectoryName),
    work: roadmapView('work', props.currentDirectoryName),
    automations: roadmapView('automations', props.currentDirectoryName),
  }
  if (isToolkitComponentEnabled(settings, 'coding')) {
    for (const component of [workingDirectoriesComponent]) {
      Object.assign(contributions, Object.fromEntries(component.views.map((view) => [view, code])))
    }
    const history = composeChatHistory(controller)
    Object.assign(
      contributions,
      Object.fromEntries(chatHistoryComponent.views.map((view) => [view, history])),
    )
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
