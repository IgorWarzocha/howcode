import { MainView } from '@howcode/app-shell'
import { ChatWorkspaceView } from '@howcode/chat-workspace'
import { CodeWorkspaceView } from '@howcode/code-workspace'
import type { ProjectDiffBaseline, ProjectDiffRenderMode } from '../desktop/types'
import { mainPanelClass } from '../ui/classes'
import type { AppShellController } from './useAppShellController'

type AppShellWorkspaceProps = {
  controller: AppShellController
  activeComposerState: AppShellController['composer']['state']
  activeThreadData: AppShellController['thread']['activeData']
  composerProjectId: string
  currentProjectName: string
  diffBaseline: ProjectDiffBaseline
  diffRenderMode: ProjectDiffRenderMode
  terminalDrawerVisible: boolean
  terminalDrawerOverlay?: boolean
  terminalConversationId: string | null
  workspaceContentClass: string
  onSetDiffBaseline: (baseline: ProjectDiffBaseline) => void
  onSetDiffRenderMode: (renderMode: ProjectDiffRenderMode) => void
  sidebarCollapsed: boolean
  sidebarAutoHidden: boolean
  sidebarCompactMode: boolean
  onToggleSidebar: () => void
}

export function AppShellWorkspace({
  controller,
  activeComposerState,
  activeThreadData,
  composerProjectId,
  currentProjectName,
  diffBaseline,
  diffRenderMode,
  terminalDrawerVisible,
  terminalDrawerOverlay = false,
  terminalConversationId,
  workspaceContentClass,
  onSetDiffBaseline,
  onSetDiffRenderMode,
  sidebarCollapsed,
  sidebarAutoHidden,
  sidebarCompactMode,
  onToggleSidebar,
}: AppShellWorkspaceProps) {
  const { state } = controller.workspace

  if (state.activeView === 'chat') {
    return (
      <ChatWorkspaceView
        controller={controller}
        activeComposerState={activeComposerState}
        activeThreadData={activeThreadData}
        composerProjectId={composerProjectId}
        diffBaseline={diffBaseline}
        diffRenderMode={diffRenderMode}
        terminalConversationId={terminalConversationId}
        onSetDiffBaseline={onSetDiffBaseline}
        onSetDiffRenderMode={onSetDiffRenderMode}
        sidebarCollapsed={sidebarCollapsed}
        sidebarAutoHidden={sidebarAutoHidden}
        sidebarCompactMode={sidebarCompactMode}
        onToggleSidebar={onToggleSidebar}
      />
    )
  }

  if (
    state.activeView === 'claw' ||
    state.activeView === 'work' ||
    state.activeView === 'automations'
  ) {
    return (
      <div className="relative min-h-0 flex-1 px-5 pt-1.5">
        <main className={mainPanelClass}>
          <MainView activeView={state.activeView} projectName={currentProjectName} />
        </main>
      </div>
    )
  }

  return (
    <CodeWorkspaceView
      controller={controller}
      activeComposerState={activeComposerState}
      activeThreadData={activeThreadData}
      composerProjectId={composerProjectId}
      currentProjectName={currentProjectName}
      diffBaseline={diffBaseline}
      diffRenderMode={diffRenderMode}
      terminalDrawerVisible={terminalDrawerVisible}
      terminalDrawerOverlay={terminalDrawerOverlay}
      terminalConversationId={terminalConversationId}
      workspaceContentClass={workspaceContentClass}
      onSetDiffBaseline={onSetDiffBaseline}
      onSetDiffRenderMode={onSetDiffRenderMode}
      sidebarCollapsed={sidebarCollapsed}
      sidebarAutoHidden={sidebarAutoHidden}
      sidebarCompactMode={sidebarCompactMode}
      onToggleSidebar={onToggleSidebar}
    />
  )
}
