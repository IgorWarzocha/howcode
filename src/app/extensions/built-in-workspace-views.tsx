import { MainView } from '@howcode/app-shell'
import { ChatWorkspaceView } from '@howcode/chat-workspace'
import { CodeWorkspaceView } from '@howcode/code-workspace'
import { isToolkitExtensionEnabled } from '@howcode/shared/toolkit-extensions'
import type { ComponentProps } from 'react'
import { mainPanelClass } from '../ui/classes'
import { workspacePlugins } from './toolkit-plugins'
import type { WorkspaceViewContributions } from './workspace-views'

type ChatProps = ComponentProps<typeof ChatWorkspaceView>
type CodeProps = ComponentProps<typeof CodeWorkspaceView>

export type BuiltInWorkspaceViewProps = CodeProps & {
  controller: ChatProps['controller'] & CodeProps['controller']
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
        inbox: controller.inbox,
        navigation: controller.navigation,
        projects: controller.projects,
        resourceScope: controller.resourceScope,
        settings: controller.settings,
        terminal: controller.terminal,
        thread: controller.thread,
        workspace: controller.workspace,
      }}
    />
  )

  const settings = controller.desktop.shellState?.appSettings
  const contributions: WorkspaceViewContributions = {
    inbox: code,
    archived: code,
    settings: code,
    chat,
    claw: roadmapView('claw', props.currentProjectName),
    work: roadmapView('work', props.currentProjectName),
    automations: roadmapView('automations', props.currentProjectName),
  }
  for (const plugin of workspacePlugins) {
    if (isToolkitExtensionEnabled(settings, plugin.id)) {
      Object.assign(contributions, plugin.contribute(code))
    }
  }
  return contributions
}
