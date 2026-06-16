import { MainView } from '@howcode/app-shell'
import { ChatWorkspaceView } from '@howcode/chat-workspace'
import { CodeWorkspaceView } from '@howcode/code-workspace'
import type { ProjectDiffBaseline, ProjectDiffRenderMode } from '../desktop/types'
import { mainPanelClass } from '../ui/classes'
import type { AppShellController } from './useAppShellController'

type AppShellWorkspaceProps = {
  controller: AppShellController
  activeComposerState: AppShellController['activeComposerState']
  activePiExtensionUiState: AppShellController['activePiExtensionUiState']
  activeThreadData: AppShellController['activeThreadData']
  composerProjectId: string
  currentProjectName: string
  diffBaseline: ProjectDiffBaseline
  diffRenderMode: ProjectDiffRenderMode
  terminalDrawerVisible: boolean
  terminalDrawerOverlay?: boolean
  terminalSessionPath: string | null
  workspaceContentClass: string
  onSetDiffBaseline: (baseline: ProjectDiffBaseline) => void
  onSetDiffRenderMode: (renderMode: ProjectDiffRenderMode) => void
  sidebarCollapsed: boolean
  sidebarAutoHidden: boolean
  sidebarCompactMode: boolean
  onToggleSidebar: () => void
  onArtifactDrawerOverlayChange?:
    | ((visible: boolean, onClose?: (() => void) | undefined) => void)
    | undefined
}

export function AppShellWorkspace({
  controller,
  activeComposerState,
  activePiExtensionUiState,
  activeThreadData,
  composerProjectId,
  currentProjectName,
  diffBaseline,
  diffRenderMode,
  terminalDrawerVisible,
  terminalDrawerOverlay = false,
  terminalSessionPath,
  workspaceContentClass,
  onSetDiffBaseline,
  onSetDiffRenderMode,
  sidebarCollapsed,
  sidebarAutoHidden,
  sidebarCompactMode,
  onToggleSidebar,
  onArtifactDrawerOverlayChange,
}: AppShellWorkspaceProps) {
  const { state } = controller

  if (state.activeView === 'chat') {
    return (
      <ChatWorkspaceView
        controller={controller}
        activeComposerState={activeComposerState}
        activePiExtensionUiState={activePiExtensionUiState}
        activeThreadData={activeThreadData}
        composerProjectId={composerProjectId}
        diffBaseline={diffBaseline}
        diffRenderMode={diffRenderMode}
        terminalSessionPath={terminalSessionPath}
        onSetDiffBaseline={onSetDiffBaseline}
        onSetDiffRenderMode={onSetDiffRenderMode}
        sidebarCollapsed={sidebarCollapsed}
        sidebarAutoHidden={sidebarAutoHidden}
        sidebarCompactMode={sidebarCompactMode}
        onToggleSidebar={onToggleSidebar}
        onArtifactDrawerOverlayChange={onArtifactDrawerOverlayChange}
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
      activePiExtensionUiState={activePiExtensionUiState}
      activeThreadData={activeThreadData}
      composerProjectId={composerProjectId}
      currentProjectName={currentProjectName}
      diffBaseline={diffBaseline}
      diffRenderMode={diffRenderMode}
      terminalDrawerVisible={terminalDrawerVisible}
      terminalDrawerOverlay={terminalDrawerOverlay}
      terminalSessionPath={terminalSessionPath}
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
