import { TerminalPanel } from '@howcode/workspace-shell'
import type { RefObject } from 'react'
import type { ProjectDiffBaseline, ProjectDiffRenderMode } from '../desktop/types'
import { appToneTextClass, appTypeGroupTextClass } from '../ui/classes'
import { cn } from '../utils/cn'
import { AppShellOverlays } from './app-shell-overlays'
import { AppShellSidebar } from './app-shell-sidebar'
import { AppShellWorkspace } from './app-shell-workspace'
import { appShellRootClass } from './layout-classes'
import type { AppShellController } from './useAppShellController'

type AppShellLayoutViewProps = {
  controller: AppShellController
  diff: {
    baseline: ProjectDiffBaseline
    onBaselineChange: (baseline: ProjectDiffBaseline) => void
    onRenderModeChange: (renderMode: ProjectDiffRenderMode) => void
    renderMode: ProjectDiffRenderMode
  }
  mainSectionRef: RefObject<HTMLElement | null>
  sidebar: {
    collapsed: boolean
    compactMode: boolean
    onOverlayOpenChange: (open: boolean) => void
    onToggle: () => void
    overlayOpen: boolean
  }
  takeover: {
    onOpenGitOps: () => Promise<void>
    present: boolean
    terminalKey: string
  }
  terminal: {
    drawerPresent: boolean
    drawerVisible: boolean
    sessionPath: string | null
  }
  workspaceContentClass: string
}

function DesktopSidebarFrame(props: AppShellLayoutViewProps) {
  const hidden = props.sidebar.collapsed || props.sidebar.compactMode
  return (
    <div
      className={
        hidden
          ? 'relative w-0 min-w-0 shrink-0 overflow-hidden opacity-0 transition-[width,opacity] duration-200 ease-out pointer-events-none'
          : 'relative w-[clamp(225px,calc(100vw_-_936px),300px)] min-w-0 shrink-0 overflow-hidden opacity-100 transition-[width,opacity] duration-200 ease-out'
      }
    >
      {hidden ? null : (
        <AppShellSidebar
          compactMode={props.sidebar.compactMode}
          controller={props.controller}
          onToggle={props.sidebar.onToggle}
        />
      )}
    </div>
  )
}

function CompactSidebarOverlay(props: AppShellLayoutViewProps) {
  if (!(props.sidebar.compactMode && props.sidebar.overlayOpen)) return null
  return (
    <button
      type="button"
      className="absolute inset-0 z-40 bg-transparent"
      aria-label="Close sidebar"
      onClick={() => props.sidebar.onOverlayOpenChange(false)}
    />
  )
}

function CompactSidebarPanel(props: AppShellLayoutViewProps) {
  if (!props.sidebar.compactMode) return null
  return (
    <div
      className={`absolute top-0 bottom-0 left-0 z-50 w-[min(300px,calc(100%_-_2rem))] min-w-0 overflow-hidden transition-[transform,opacity] duration-200 ease-out ${props.sidebar.overlayOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none'}`}
    >
      <AppShellSidebar
        compactMode={props.sidebar.compactMode}
        controller={props.controller}
        onToggle={props.sidebar.onToggle}
      />
    </div>
  )
}

function AppShellWorkspaceSection(props: AppShellLayoutViewProps) {
  const { mainSectionRef, controller, workspaceContentClass } = props
  const takeoverVisible = controller.workspace.state.takeoverVisible
  return (
    <section
      ref={mainSectionRef}
      className="flex min-w-0 min-h-0 h-full flex-1 flex-col overflow-hidden bg-[color:var(--workspace)]"
    >
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          data-open={takeoverVisible ? 'false' : 'true'}
          className="motion-desktop-workspace flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <AppShellWorkspace
            controller={controller}
            activeComposerState={controller.composer.state}
            activePiExtensionUiState={controller.composer.extensionUiState}
            activeThreadData={controller.thread.activeData}
            composerProjectId={controller.composer.projectId}
            currentProjectName={controller.projects.currentName}
            diffBaseline={props.diff.baseline}
            diffRenderMode={props.diff.renderMode}
            terminalDrawerVisible={props.terminal.drawerVisible}
            terminalSessionPath={props.terminal.sessionPath}
            workspaceContentClass={workspaceContentClass}
            onSetDiffBaseline={props.diff.onBaselineChange}
            onSetDiffRenderMode={props.diff.onRenderModeChange}
            sidebarCollapsed={props.sidebar.collapsed}
            sidebarAutoHidden={props.sidebar.compactMode}
            sidebarCompactMode={props.sidebar.compactMode}
            onToggleSidebar={props.sidebar.onToggle}
          />
        </div>
        <AppShellOverlays
          controller={controller}
          composerProjectId={controller.composer.projectId}
          diffBaseline={props.diff.baseline}
          takeoverPresent={props.takeover.present}
          takeoverVisible={takeoverVisible}
          takeoverTerminalKey={props.takeover.terminalKey}
          terminalDrawerVisible={props.terminal.drawerVisible}
          terminalSessionPath={props.terminal.sessionPath}
          terminalDrawerOverlay={props.sidebar.compactMode}
          sidebarCollapsed={props.sidebar.collapsed}
          sidebarCompactMode={props.sidebar.compactMode}
          sidebarOverlayOpen={props.sidebar.overlayOpen}
          onToggleSidebar={props.sidebar.onToggle}
          onOpenGitOps={props.takeover.onOpenGitOps}
          onSetDiffBaseline={props.diff.onBaselineChange}
        />
        <TerminalDrawerLayer {...props} />
      </div>
    </section>
  )
}

function TerminalDrawerLayer(props: AppShellLayoutViewProps) {
  const { controller } = props
  if (!props.terminal.drawerPresent) return null
  return (
    <div
      className={cn(
        'pointer-events-none absolute top-0 right-0 bottom-0 z-20 max-w-full overflow-hidden',
        props.sidebar.compactMode ? 'w-full' : 'w-[min(28rem,calc(100%_-_2.5rem))]',
      )}
    >
      <div
        data-open={props.terminal.drawerVisible ? 'true' : 'false'}
        className={`motion-terminal-drawer absolute inset-0 min-h-0 min-w-0 ${props.terminal.drawerVisible ? 'pointer-events-auto' : 'pointer-events-none'}`}
      >
        <TerminalPanel
          projectId={controller.composer.projectId}
          sessionPath={props.terminal.sessionPath}
          onClose={controller.terminal.closeDrawer}
          hoverToFocus={controller.desktop.shellState?.appSettings.hoverToFocus ?? true}
          hoverToBlur={controller.desktop.shellState?.appSettings.hoverToBlur ?? false}
        />
      </div>
    </div>
  )
}

function AppShellToast(props: AppShellLayoutViewProps) {
  const { controller } = props
  if (!controller.app.toast) return null
  return (
    <div
      className={cn(
        'pointer-events-none fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-2xl border border-[color:var(--border-strong)] bg-[rgba(14,18,28,0.94)] px-4 py-2 backdrop-blur-sm',
        appTypeGroupTextClass,
        appToneTextClass,
      )}
    >
      {controller.app.toast}
    </div>
  )
}

function MacWindowDragZones() {
  return (
    <div className="mac-window-drag-zones" aria-hidden="true">
      <div className="mac-window-drag-zone mac-window-drag-zone--titlebar" />
    </div>
  )
}

export function AppShellLayoutView(props: AppShellLayoutViewProps) {
  return (
    <>
      <div className={appShellRootClass}>
        <MacWindowDragZones />
        <DesktopSidebarFrame {...props} />
        <CompactSidebarOverlay {...props} />
        <CompactSidebarPanel {...props} />
        <AppShellWorkspaceSection {...props} />
      </div>
      <AppShellToast {...props} />
    </>
  )
}
