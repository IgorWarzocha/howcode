import { Check, GitPullRequestDraft } from 'lucide-react'
import type { RefObject } from 'react'
import { createPortal } from 'react-dom'
import {
  getFeatureStatusBadgeClass,
  getFeatureStatusDataAttributes,
} from '../../../../features/feature-status'
import {
  composerPopoverInputClass,
  composerPopoverOptionClass,
  composerPopoverOptionSelectedClass,
  composerPopoverSectionLabelClass,
  popoverPanelClass,
} from '../../../../ui/classes'
import { cn } from '../../../../utils/cn'
import { SurfacePanel } from '../../../common/surface-panel'

export type BranchSelectorPanelPosition = {
  left: number
  bottom: number
  width: number
  maxHeight: number
}

export function ComposerBranchSelectorPopover({
  branchLabel,
  branches,
  branchSwitchInput,
  inputRef,
  panelId,
  panelPosition,
  panelRef,
  positionReady,
  onSetBranchSwitchInput,
  onSetBranchSwitchOpen,
  onSwitchBranch,
}: {
  branchLabel: string
  branches: readonly string[]
  branchSwitchInput: string
  inputRef: RefObject<HTMLInputElement | null>
  panelId: string
  panelPosition: BranchSelectorPanelPosition
  panelRef: RefObject<HTMLDivElement | null>
  positionReady: boolean
  onSetBranchSwitchInput: (value: string) => void
  onSetBranchSwitchOpen: (open: boolean) => void
  onSwitchBranch: (branchName: string) => void
}) {
  if (typeof document === 'undefined') return null

  const submitBranchSwitch = () => {
    const nextBranch = branchSwitchInput.trim()
    if (!nextBranch) return
    onSwitchBranch(nextBranch)
    onSetBranchSwitchOpen(false)
  }
  const visibleBranches = branches.filter((branch) =>
    branch.toLowerCase().includes(branchSwitchInput.trim().toLowerCase()),
  )

  return createPortal(
    <SurfacePanel
      id={panelId}
      ref={panelRef}
      data-open={positionReady ? 'true' : 'false'}
      aria-label="Branch selector"
      className={cn(
        popoverPanelClass,
        'motion-popover fixed z-[160] grid max-h-[calc(100vh-1rem)] grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-1.5 rounded-xl border-0 p-1.5 transition-[opacity,transform] duration-150 ease-out',
        positionReady ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-1 opacity-0',
      )}
      style={{
        bottom: `${panelPosition.bottom}px`,
        left: `${panelPosition.left}px`,
        maxHeight: `${panelPosition.maxHeight}px`,
        width: `${panelPosition.width}px`,
      }}
    >
      <div className={composerPopoverSectionLabelClass}>Switch branch</div>
      <div className="grid max-h-40 min-h-0 gap-0.5 overflow-y-auto pb-0.5 pr-1 [scrollbar-gutter:stable]">
        {visibleBranches.length > 0 ? (
          visibleBranches.map((branch) => (
            <button
              key={branch}
              type="button"
              className={cn(
                composerPopoverOptionClass,
                'min-h-8 py-1.5',
                branch === branchLabel && composerPopoverOptionSelectedClass,
              )}
              onClick={() => {
                onSwitchBranch(branch)
                onSetBranchSwitchOpen(false)
              }}
            >
              <span className="inline-flex items-center justify-center text-[color:var(--accent)]">
                {branch === branchLabel ? <Check size={13} /> : null}
              </span>
              <span
                className={cn(
                  'truncate',
                  branch === branchLabel ? 'text-[color:var(--text)]' : 'text-[color:var(--muted)]',
                )}
              >
                {branch}
              </span>
            </button>
          ))
        ) : (
          <div className="px-2 py-1.5 text-[12px] text-[color:var(--muted)]">
            Press Enter to check out “{branchSwitchInput.trim()}”
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        value={branchSwitchInput}
        onChange={(event) => onSetBranchSwitchInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submitBranchSwitch()
          if (event.key === 'Escape') onSetBranchSwitchOpen(false)
        }}
        className={composerPopoverInputClass}
        placeholder="Search branches"
      />
      <div
        className="grid min-h-[82px] gap-2 rounded-lg bg-[color:var(--surface-hover)] p-2.5"
        {...getFeatureStatusDataAttributes('feature:composer.worktrees')}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[color:var(--panel)] text-[color:var(--muted)]">
              <GitPullRequestDraft size={14} />
            </span>
            <div className="min-w-0">
              <div className="truncate text-[12.5px] font-medium text-[color:var(--text)]">
                Worktrees
              </div>
              <div className="truncate text-[11px] text-[color:var(--muted)]">
                Reserved for linked branch workspaces.
              </div>
            </div>
          </div>
          <span className={getFeatureStatusBadgeClass('feature:composer.worktrees')}>Mock</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-[11px] text-[color:var(--muted)]">
          <div className="rounded-md bg-[color:var(--panel)] px-2 py-1.5">Create worktree</div>
          <div className="rounded-md bg-[color:var(--panel)] px-2 py-1.5">Open existing</div>
        </div>
      </div>
    </SurfacePanel>,
    document.body,
  )
}
