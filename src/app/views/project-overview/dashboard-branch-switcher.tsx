import { Check, GitPullRequestDraft } from 'lucide-react'
import { type CSSProperties, type RefObject, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { DesktopActionInvoker, ProjectGitState } from '../../desktop/types'
import {
  getFeatureStatusBadgeClass,
  getFeatureStatusDataAttributes,
} from '../../features/feature-status'
import { useDismissibleLayer } from '../../hooks/useDismissibleLayer'
import type { Project } from '../../types'
import { cn } from '../../utils/cn'

const dashboardBranchPopoverInputClass =
  'box-border block h-8 w-full min-w-0 rounded-lg border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] px-2 text-[11px] leading-4 text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted)]'

function DashboardBranchSwitchPopover({
  anchorRef,
  branchSwitchInput,
  currentBranch,
  filteredBranches,
  inputRef,
  panelRef,
  projectId,
  onAction,
  onSetBranchSwitchInput,
  onSetBranchSwitchOpen,
  onSubmitBranchSwitch,
}: {
  anchorRef: RefObject<HTMLElement | null>
  branchSwitchInput: string
  currentBranch: string | null | undefined
  filteredBranches: readonly string[]
  inputRef: RefObject<HTMLInputElement | null>
  panelRef: RefObject<HTMLDivElement | null>
  projectId: string
  onAction: DesktopActionInvoker
  onSetBranchSwitchInput: (value: string) => void
  onSetBranchSwitchOpen: (open: boolean) => void
  onSubmitBranchSwitch: () => void
}) {
  const [position, setPosition] = useState<CSSProperties | null>(null)
  const visibleBranches = filteredBranches.slice(0, 5)

  useEffect(() => {
    const anchor = anchorRef.current
    if (!anchor) return
    const updatePosition = () => {
      const rect = anchor.getBoundingClientRect()
      const width = Math.min(320, window.innerWidth - 16)
      setPosition({
        background: 'var(--panel)',
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        opacity: 1,
        top: rect.bottom + 6,
        width,
      })
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [anchorRef])

  if (!position || typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-[160] isolate grid min-w-0 gap-2 rounded-xl border border-[color:var(--border-strong)] p-2 shadow-[0_18px_48px_rgba(0,0,0,0.42)]"
      style={{ ...position, boxSizing: 'border-box' }}
    >
      <div className="px-1 text-[11px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
        Switch branch
      </div>
      <input
        ref={inputRef}
        value={branchSwitchInput}
        onChange={(event) => onSetBranchSwitchInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onSubmitBranchSwitch()
          if (event.key === 'Escape') onSetBranchSwitchOpen(false)
        }}
        className={dashboardBranchPopoverInputClass}
        placeholder="Search branches"
      />
      <div className="grid max-h-36 min-w-0 gap-0.5 overflow-y-auto">
        {visibleBranches.length > 0 ? (
          visibleBranches.map((branch) => (
            <button
              key={branch}
              type="button"
              className={cn(
                'grid min-h-7 w-full grid-cols-[14px_minmax(0,1fr)] items-center gap-1.5 rounded-lg px-2 py-1 text-left text-[10.5px] leading-4 text-[color:var(--muted)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]',
                branch === currentBranch && 'bg-[rgba(255,255,255,0.06)] text-[color:var(--text)]',
              )}
              style={{ fontSize: 10.5, lineHeight: '16px' }}
              onClick={() => {
                onSetBranchSwitchOpen(false)
                void onAction('workspace.switch-branch', { projectId, value: branch })
              }}
            >
              <span className="inline-flex items-center justify-center text-[color:var(--accent)]">
                {branch === currentBranch ? <Check size={12} /> : null}
              </span>
              <span className="min-w-0 truncate">{branch}</span>
            </button>
          ))
        ) : (
          <div className="px-2 py-1.5 text-[12px] text-[color:var(--muted)]">
            Press Enter to check out “{branchSwitchInput.trim()}”
          </div>
        )}
      </div>
      <div
        className="grid min-h-[86px] min-w-0 gap-2 rounded-xl border border-dashed border-[color:var(--border)] bg-[rgba(255,255,255,0.025)] p-2.5"
        style={{ boxSizing: 'border-box' }}
        {...getFeatureStatusDataAttributes('feature:composer.worktrees')}
      >
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--panel-2)] text-[color:var(--muted)]">
              <GitPullRequestDraft size={12} />
            </span>
            <div className="min-w-0">
              <div className="truncate text-[11px] font-medium text-[color:var(--text)]">
                Worktrees
              </div>
              <div className="truncate text-[10.5px] text-[color:var(--muted)]">
                Reserved for branch workspaces.
              </div>
            </div>
          </div>
          <span
            className={cn(getFeatureStatusBadgeClass('feature:composer.worktrees'), 'shrink-0')}
          >
            Mock
          </span>
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-1.5 text-[10.5px] text-[color:var(--muted)]">
          <div className="min-w-0 truncate rounded-lg border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] px-2 py-1.5">
            Create
          </div>
          <div className="min-w-0 truncate rounded-lg border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] px-2 py-1.5">
            Open
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function DashboardBranchSwitcher({
  branchLabel,
  gitState,
  project,
  onAction,
}: {
  branchLabel: string
  gitState: ProjectGitState
  project: Project
  onAction: DesktopActionInvoker
}) {
  const [branchSwitchOpen, setBranchSwitchOpen] = useState(false)
  const [branchSwitchInput, setBranchSwitchInput] = useState('')
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const toggleBranchSwitch = () => {
    setBranchSwitchInput('')
    setBranchSwitchOpen((open) => !open)
  }
  const filteredBranches = (gitState.branches ?? []).filter((branch) =>
    branch.toLowerCase().includes(branchSwitchInput.trim().toLowerCase()),
  )
  const submitBranchSwitch = () => {
    const nextBranch = branchSwitchInput.trim()
    if (!nextBranch) return
    setBranchSwitchOpen(false)
    void onAction('workspace.switch-branch', { projectId: project.id, value: nextBranch })
  }

  useDismissibleLayer({
    open: branchSwitchOpen,
    onDismiss: () => setBranchSwitchOpen(false),
    refs: [buttonRef, panelRef],
  })

  useEffect(() => {
    if (!branchSwitchOpen) return
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }, [branchSwitchOpen])

  return (
    <span className="relative inline-flex min-w-0 shrink">
      <button
        ref={buttonRef}
        type="button"
        className="pointer-events-auto relative z-20 inline-flex min-w-0 max-w-[14rem] shrink cursor-pointer items-center truncate rounded-full bg-[rgba(169,178,215,0.08)] px-2 py-0.5 text-left text-[11px] text-[color:var(--muted)] transition-colors hover:bg-[rgba(169,178,215,0.14)] hover:text-[color:var(--text)]"
        onPointerDownCapture={(event) => {
          event.preventDefault()
          event.stopPropagation()
          toggleBranchSwitch()
        }}
        onClick={(event) => {
          if (event.detail === 0) toggleBranchSwitch()
        }}
        aria-label="Switch branch"
        aria-expanded={branchSwitchOpen}
        aria-haspopup="dialog"
      >
        {branchLabel}
      </button>
      {branchSwitchOpen ? (
        <DashboardBranchSwitchPopover
          anchorRef={buttonRef}
          branchSwitchInput={branchSwitchInput}
          currentBranch={gitState.branch}
          filteredBranches={filteredBranches}
          inputRef={inputRef}
          panelRef={panelRef}
          projectId={project.id}
          onAction={onAction}
          onSetBranchSwitchInput={setBranchSwitchInput}
          onSetBranchSwitchOpen={setBranchSwitchOpen}
          onSubmitBranchSwitch={submitBranchSwitch}
        />
      ) : null}
    </span>
  )
}
