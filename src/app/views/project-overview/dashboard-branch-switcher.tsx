import { type CSSProperties, type RefObject, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BranchSwitchPopover } from '../../components/workspace/branch-switch-popover'
import type { DesktopActionInvoker, ProjectGitState } from '../../desktop/types'
import { useDismissibleLayer } from '../../hooks/useDismissibleLayer'
import type { Project } from '../../types'
import { cn } from '../../utils/cn'

function DashboardBranchSwitchPopover({
  anchorRef,
  branchSwitchInput,
  currentBranch,
  branches,
  inputRef,
  panelRef,
  onSetBranchSwitchInput,
  onSetBranchSwitchOpen,
  onSwitchBranch,
}: {
  anchorRef: RefObject<HTMLElement | null>
  branchSwitchInput: string
  currentBranch: string | null | undefined
  branches: readonly string[]
  inputRef: RefObject<HTMLInputElement | null>
  panelRef: RefObject<HTMLDivElement | null>
  onSetBranchSwitchInput: (value: string) => void
  onSetBranchSwitchOpen: (open: boolean) => void
  onSwitchBranch: (branchName: string) => void
}) {
  const [position, setPosition] = useState<CSSProperties | null>(null)

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
    <BranchSwitchPopover
      branchLabel={currentBranch}
      branchListClassName="max-h-[8.5rem]"
      branches={branches}
      branchSwitchInput={branchSwitchInput}
      inputRef={inputRef}
      panelRef={panelRef}
      className="fixed z-[160] isolate"
      style={{ ...position, boxSizing: 'border-box' }}
      onSetBranchSwitchInput={onSetBranchSwitchInput}
      onSetBranchSwitchOpen={onSetBranchSwitchOpen}
      onSwitchBranch={onSwitchBranch}
    />,
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
  const switchBranch = (branchName: string) => {
    void onAction('workspace.switch-branch', { projectId: project.id, value: branchName })
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
        className={cn(
          'composer-footer-text pointer-events-auto relative z-20 inline-flex min-w-0 max-w-[14rem] shrink cursor-pointer items-center truncate rounded-md px-2 py-0.5 text-left transition-colors hover:bg-[color:var(--surface-hover)]',
          branchSwitchOpen && 'bg-[color:var(--surface-hover)]',
        )}
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
        <span className="truncate text-[color:var(--muted)]">{branchLabel}</span>
      </button>
      {branchSwitchOpen ? (
        <DashboardBranchSwitchPopover
          anchorRef={buttonRef}
          branches={gitState.branches ?? []}
          branchSwitchInput={branchSwitchInput}
          currentBranch={gitState.branch}
          inputRef={inputRef}
          panelRef={panelRef}
          onSetBranchSwitchInput={setBranchSwitchInput}
          onSetBranchSwitchOpen={setBranchSwitchOpen}
          onSwitchBranch={switchBranch}
        />
      ) : null}
    </span>
  )
}
