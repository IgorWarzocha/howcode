import { BranchSwitchPopover } from '@howcode/native-gitops'
import { type RefObject, useEffect, useRef, useState } from 'react'
import { AnchoredPopoverPanel } from '../../common/popover'
import {
  notifyComposerPopoverOpened,
  useComposerPopoverDismissSignal,
} from '../../composer/composer-popover-coordination'
import type { DesktopActionInvoker, ProjectGitState } from '../../desktop/types'
import { useDismissibleLayer } from '../../hooks/useDismissibleLayer'
import type { Project } from '../../types'
import { composerPopoverPanelClass } from '../../ui/classes'
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
  return (
    <BranchSwitchPopover
      branchLabel={currentBranch}
      branchListClassName="max-h-[8.5rem]"
      branches={branches}
      branchSwitchInput={branchSwitchInput}
      inputRef={inputRef}
      panelRef={panelRef}
      className="w-[min(20rem,calc(100vw-1rem))] isolate"
      onSetBranchSwitchInput={onSetBranchSwitchInput}
      onSetBranchSwitchOpen={onSetBranchSwitchOpen}
      onSwitchBranch={onSwitchBranch}
      asChild={(content) => (
        <AnchoredPopoverPanel
          anchorRef={anchorRef}
          panelRef={panelRef}
          open
          placement="bottom-start"
          gap={6}
          surface={false}
          className={cn(
            composerPopoverPanelClass,
            'grid w-[min(20rem,calc(100vw-1rem))] min-w-0 max-w-full grid-rows-[auto_minmax(0,1fr)_auto] gap-1.5 overflow-hidden',
          )}
        >
          {content}
        </AnchoredPopoverPanel>
      )}
    />
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
  useComposerPopoverDismissSignal({
    ignoreSource: 'dashboard-branch',
    onDismiss: () => setBranchSwitchOpen(false),
  })

  const toggleBranchSwitch = () => {
    notifyComposerPopoverOpened('dashboard-branch')
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
