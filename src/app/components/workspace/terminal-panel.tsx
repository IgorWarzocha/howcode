import { GitBranch, PanelRightClose, SquareTerminal } from 'lucide-react'
import { memo, useRef } from 'react'
import type { ProjectDiffBaseline, ProjectGitState } from '../../desktop/types'
import { type FeatureStatusId, getFeatureStatusDataAttributes } from '../../features/feature-status'
import { compactIconButtonClass } from '../../ui/classes'
import { cn } from '../../utils/cn'
import { HowcodeLogoMark } from '../common/howcode-logo-mark'
import { ToolbarButton } from '../common/toolbar-button'
import { ComposerDiffBaselineSelector } from './composer/composer-diff-baseline-selector'
import { getGitOpsEntryButtonClass } from './composer/git-ops'
import {
  WorkspaceBranchChip,
  workspaceFooterRowClass,
  workspaceFooterTextClass,
  workspaceFooterTrailingGroupClass,
} from './footer/workspace-footer-primitives'
import { TerminalViewport } from './terminal/terminal-viewport'

const PI_TUI_KEEP_ALIVE_MS = 300_000
const PI_TUI_SESSION_FILE_IDLE_POLL_MS = 5 * 60_000

type TerminalPanelProps = {
  projectId: string
  sessionPath: string | null
  onClose: () => void
  onOpenDrawerTerminal?: () => void
  onOpenGitOps?: () => void
  mode?: 'drawer' | 'takeover'
  projectGitState?: ProjectGitState | null
  diffBaseline?: ProjectDiffBaseline
  onSetDiffBaseline?: (baseline: ProjectDiffBaseline) => void
  hoverToFocus?: boolean
  hoverToBlur?: boolean
}

function TerminalPanelComponent({
  projectId,
  sessionPath,
  onClose,
  onOpenDrawerTerminal,
  onOpenGitOps,
  mode = 'drawer',
  projectGitState = null,
  diffBaseline,
  onSetDiffBaseline,
  hoverToFocus = true,
  hoverToBlur = false,
}: TerminalPanelProps) {
  const statusId: FeatureStatusId = 'feature:terminal.panel'
  const panelRef = useRef<HTMLDivElement>(null)
  const gitVisualMode = projectGitState?.isGitRepo
    ? projectGitState.fileCount > 0
      ? 'dirty'
      : 'clean'
    : 'not-git'

  if (mode === 'takeover') {
    return (
      <section
        ref={panelRef}
        aria-label="Pi terminal panel"
        className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] bg-transparent"
        {...getFeatureStatusDataAttributes(statusId)}
      >
        <TerminalViewport
          projectId={projectId}
          sessionPath={sessionPath}
          launchMode="pi-session"
          onProcessExit={onClose}
          keepAliveMsOnUnmount={PI_TUI_KEEP_ALIVE_MS}
          closeWhenSessionFileIdleMs={PI_TUI_SESSION_FILE_IDLE_POLL_MS}
          backgroundCssVar="--workspace"
          hoverToFocus={hoverToFocus}
          hoverToBlur={hoverToBlur}
          stickToBottomOnOutput={false}
          className="terminal-viewport--flush relative z-0 min-h-0 rounded-none bg-[color:var(--workspace)]"
        />
        <div className="relative z-[80] overflow-visible rounded-b-[20px] border-x border-b border-[color:var(--border)] bg-[color:var(--panel)] shadow-[var(--shadow)]">
          <div className="h-px bg-[color:var(--border)]" />
          <div className={cn(workspaceFooterRowClass, 'rounded-b-[20px]')}>
            <ToolbarButton
              label="Desktop"
              tooltip="Howcode Desktop"
              icon={<HowcodeLogoMark className="h-[14px] w-[14px]" />}
              className={workspaceFooterTextClass}
              onClick={onClose}
            />
            <ToolbarButton
              label="Terminal"
              tooltip="Shell terminal"
              icon={<SquareTerminal size={14} />}
              className={workspaceFooterTextClass}
              onClick={onOpenDrawerTerminal}
            />
            <div className={workspaceFooterTrailingGroupClass}>
              {projectGitState?.isGitRepo && diffBaseline && onSetDiffBaseline ? (
                <ComposerDiffBaselineSelector
                  composerPanelRef={panelRef}
                  projectId={projectId}
                  projectGitState={projectGitState}
                  selectedBaseline={diffBaseline}
                  onSelectBaseline={onSetDiffBaseline}
                />
              ) : null}
              {projectGitState?.isGitRepo ? (
                <WorkspaceBranchChip branch={projectGitState.branch} />
              ) : null}
              <button
                type="button"
                className={cn(compactIconButtonClass, getGitOpsEntryButtonClass(gitVisualMode))}
                onClick={onOpenGitOps}
                aria-label="Git ops"
                data-tooltip="Git ops"
              >
                <GitBranch size={14} />
              </button>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section
      aria-label="Terminal drawer"
      className="absolute inset-0 flex min-h-0 flex-col overflow-hidden border-l border-[color:var(--border)] bg-[color:var(--workspace)]"
      {...getFeatureStatusDataAttributes(statusId)}
    >
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden bg-[color:var(--sidebar)]">
        <TerminalViewport
          projectId={projectId}
          sessionPath={sessionPath}
          launchMode="shell"
          preserveSessionOnUnmount
          backgroundCssVar="--sidebar"
          hoverToFocus={hoverToFocus}
          hoverToBlur={hoverToBlur}
          bottomAlignInitialContent
          className="terminal-viewport--flush !min-h-0 rounded-none bg-[color:var(--sidebar)]"
        />
      </div>
      <div className="flex h-[3.75rem] shrink-0 items-start justify-end gap-3 border-t border-[color:var(--border)] bg-[color:var(--workspace)] px-3 pt-1.5">
        <button
          type="button"
          className="box-border inline-flex h-8 min-h-8 w-8 min-w-8 shrink-0 items-center justify-center rounded-full text-[color:var(--muted)] text-[15px] leading-none transition-colors duration-150 ease-out hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] [&>svg]:h-[15px] [&>svg]:w-[15px]"
          aria-label="Hide terminal"
          onClick={onClose}
          data-tooltip="Hide terminal"
          data-tooltip-placement="left"
        >
          <PanelRightClose />
        </button>
      </div>
    </section>
  )
}

export const TerminalPanel = memo(TerminalPanelComponent)
