import { MainView } from '@howcode/app-shell'
import { ChatWorkspaceView } from '@howcode/chat-workspace'
import { CodeWorkspaceView } from '@howcode/code-workspace'
import type { ComponentProps, ReactElement } from 'react'
import type { View } from '../types'
import { mainPanelClass } from '../ui/classes'

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

  // Keep the same CodeWorkspaceView identity across its legacy routes so local
  // drawer/footer state is not reset when switching between them.
  return {
    landing: code,
    inbox: code,
    code,
    project: code,
    thread: code,
    gitops: code,
    archived: code,
    sessions: code,
    settings: code,
    skills: code,
    chat,
    claw: roadmapView('claw', props.currentProjectName),
    work: roadmapView('work', props.currentProjectName),
    automations: roadmapView('automations', props.currentProjectName),
  } satisfies Record<View, ReactElement>
}
