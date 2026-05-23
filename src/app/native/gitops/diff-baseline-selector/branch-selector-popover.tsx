import type { RefObject } from 'react'
import { createPortal } from 'react-dom'
import { popoverPanelClass } from '../../../ui/classes'
import { cn } from '../../../utils/cn'
import { BranchSwitchPopover } from '../branch-switch-popover'

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

  return createPortal(
    <BranchSwitchPopover
      branchLabel={branchLabel}
      branches={branches}
      branchSwitchInput={branchSwitchInput}
      inputRef={inputRef}
      panelId={panelId}
      panelRef={panelRef}
      visible={positionReady}
      className={cn(
        popoverPanelClass,
        'motion-popover fixed z-[160] max-h-[calc(100vh-1rem)] border-0 transition-[opacity,transform] duration-150 ease-out',
        positionReady ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-1 opacity-0',
      )}
      style={{
        bottom: `${panelPosition.bottom}px`,
        left: `${panelPosition.left}px`,
        maxHeight: `${panelPosition.maxHeight}px`,
        width: `${panelPosition.width}px`,
      }}
      onSetBranchSwitchInput={onSetBranchSwitchInput}
      onSetBranchSwitchOpen={onSetBranchSwitchOpen}
      onSwitchBranch={onSwitchBranch}
    />,
    document.body,
  )
}
