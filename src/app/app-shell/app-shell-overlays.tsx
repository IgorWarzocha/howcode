import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useCallback, useRef } from 'react'
import { TerminalPanel } from '../components/workspace/terminal-panel'
import type { ProjectDiffBaseline } from '../desktop/types'
import { cn } from '../utils/cn'
import type { AppShellController } from './useAppShellController'

const TERMINAL_DRAWER_OFFSET = 'min(28rem, calc(100% - 2.5rem))'

type AppShellOverlaysProps = {
  controller: AppShellController
  composerProjectId: string
  diffBaseline: ProjectDiffBaseline
  takeoverPresent: boolean
  takeoverVisible: boolean
  takeoverTerminalKey: string
  terminalDrawerVisible: boolean
  terminalSessionPath: string | null
  terminalDrawerOverlay?: boolean
  sidebarCollapsed: boolean
  sidebarCompactMode: boolean
  sidebarOverlayOpen: boolean
  workspaceContentClass: string
  onToggleSidebar: () => void
  onOpenGitOps: () => void
  onSetDiffBaseline: (baseline: ProjectDiffBaseline) => void
  hoverToFocus?: boolean
  hoverToBlur?: boolean
}

type TakeoverSidebarButtonProps = {
  sidebarCollapsed: boolean
  sidebarCompactMode: boolean
  sidebarOverlayOpen: boolean
  className?: string
  onToggleSidebar: () => void
}

function TakeoverSidebarButton({
  sidebarCollapsed,
  sidebarCompactMode,
  sidebarOverlayOpen,
  className,
  onToggleSidebar,
}: TakeoverSidebarButtonProps) {
  const showSidebarButton = sidebarCompactMode ? !sidebarOverlayOpen : true
  if (!showSidebarButton) return null
  const label = sidebarCollapsed || sidebarCompactMode ? 'Show sidebar' : 'Hide sidebar'

  return (
    <div className={cn('pointer-events-none z-[90]', className)}>
      <button
        type="button"
        className="pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--panel)] text-[color:var(--muted)] opacity-70 shadow-[0_10px_28px_rgba(0,0,0,0.22)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] hover:opacity-100"
        onClick={onToggleSidebar}
        aria-label={label}
        data-tooltip={label}
        data-tooltip-placement="right"
      >
        {sidebarCollapsed || sidebarCompactMode ? (
          <PanelLeftOpen size={15} />
        ) : (
          <PanelLeftClose size={15} />
        )}
      </button>
    </div>
  )
}

export function AppShellOverlays({
  controller,
  composerProjectId,
  diffBaseline,
  takeoverPresent,
  takeoverVisible,
  takeoverTerminalKey,
  terminalDrawerVisible,
  terminalSessionPath,
  terminalDrawerOverlay = false,
  sidebarCollapsed,
  sidebarCompactMode,
  sidebarOverlayOpen,
  onToggleSidebar,
  onOpenGitOps,
  onSetDiffBaseline,
  hoverToFocus = true,
  hoverToBlur = false,
}: AppShellOverlaysProps) {
  const controllerRef = useRef(controller)
  const { projectGitState } = controller
  controllerRef.current = controller

  const handleReturnToDesktopFromTakeover = useCallback(() => {
    controllerRef.current.handleReturnToDesktopFromTakeover()
  }, [])

  const handleToggleTerminal = useCallback(() => {
    controllerRef.current.handleToggleTerminal()
  }, [])
  const sidebarButtonProps = {
    sidebarCollapsed,
    sidebarCompactMode,
    sidebarOverlayOpen,
    onToggleSidebar,
  }
  const showSidebarEdgeButton = !(sidebarCompactMode || sidebarCollapsed)

  return takeoverPresent ? (
    <div
      data-open={takeoverVisible ? 'true' : 'false'}
      className="motion-takeover-panel absolute inset-0 z-10 h-full min-h-0 overflow-hidden bg-[color:var(--workspace)] px-5 pb-4"
    >
      <div
        className="motion-terminal-drawer-offset relative h-full min-h-0 overflow-hidden"
        style={
          terminalDrawerVisible && !terminalDrawerOverlay
            ? { paddingRight: TERMINAL_DRAWER_OFFSET }
            : undefined
        }
      >
        <div className="grid h-full min-h-0 w-full grid-cols-[2rem_minmax(0,800px)_2rem] items-end justify-center gap-2">
          {showSidebarEdgeButton ? null : (
            <TakeoverSidebarButton {...sidebarButtonProps} className="mb-2 justify-self-end" />
          )}
          <div className="col-start-2 h-full min-h-0 w-full">
            <TerminalPanel
              key={takeoverTerminalKey}
              projectId={composerProjectId}
              sessionPath={terminalSessionPath}
              onClose={handleReturnToDesktopFromTakeover}
              onOpenDrawerTerminal={handleToggleTerminal}
              onOpenGitOps={onOpenGitOps}
              mode="takeover"
              projectGitState={projectGitState}
              diffBaseline={diffBaseline}
              onSetDiffBaseline={onSetDiffBaseline}
              hoverToFocus={hoverToFocus}
              hoverToBlur={hoverToBlur}
            />
          </div>
        </div>
      </div>
      {showSidebarEdgeButton ? (
        <TakeoverSidebarButton {...sidebarButtonProps} className="absolute bottom-6 left-5" />
      ) : null}
    </div>
  ) : null
}
