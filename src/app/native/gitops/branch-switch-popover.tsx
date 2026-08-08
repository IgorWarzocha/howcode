import { Check } from 'lucide-react'
import type { CSSProperties, ReactNode, RefObject } from 'react'
import { PopoverPanel } from '../../common/popover'
import {
  appToneMutedClass,
  appToneTextClass,
  appTypeControlClass,
  appTypeSmallClass,
  composerPopoverInputClass,
  composerPopoverOptionClass,
  composerPopoverOptionSelectedClass,
  composerPopoverPanelClass,
  composerPopoverSectionLabelClass,
} from '../../ui/classes'
import { cn } from '../../utils/cn'

type BranchSwitchPopoverProps = {
  asChild?: ((content: ReactNode) => ReactNode) | undefined
  branchLabel: string | null | undefined
  branches: readonly string[]
  branchSwitchInput: string
  branchListClassName?: string | undefined
  className?: string | undefined
  inputRef: RefObject<HTMLInputElement | null>
  panelId?: string | undefined
  panelRef: RefObject<HTMLDivElement | null>
  style?: CSSProperties | undefined
  visible?: boolean | undefined
  onSetBranchSwitchInput: (value: string) => void
  onSetBranchSwitchOpen: (open: boolean) => void
  onSwitchBranch: (branchName: string) => void
}

export function BranchSwitchPopover({
  asChild,
  branchLabel,
  branches,
  branchSwitchInput,
  branchListClassName,
  className,
  inputRef,
  panelId,
  panelRef,
  style,
  visible = true,
  onSetBranchSwitchInput,
  onSetBranchSwitchOpen,
  onSwitchBranch,
}: BranchSwitchPopoverProps) {
  const currentBranch = branchLabel ?? ''
  const visibleBranches = branches.filter((branch) =>
    branch.toLowerCase().includes(branchSwitchInput.trim().toLowerCase()),
  )
  const submitBranchSwitch = () => {
    const nextBranch = branchSwitchInput.trim()
    if (!nextBranch) return
    onSwitchBranch(nextBranch)
    onSetBranchSwitchOpen(false)
  }

  const content = (
    <>
      <div className={composerPopoverSectionLabelClass}>Switch branch</div>
      <div
        className={cn(
          'grid min-h-0 gap-0.5 overflow-y-auto pr-1 pb-0.5 [scrollbar-gutter:stable]',
          branchListClassName ?? 'max-h-40',
        )}
      >
        {visibleBranches.length > 0 ? (
          visibleBranches.map((branch) => (
            <button
              key={branch}
              type="button"
              className={cn(
                composerPopoverOptionClass,
                'min-h-8 min-w-0 max-w-full overflow-hidden py-1.5',
                branch === currentBranch && composerPopoverOptionSelectedClass,
              )}
              onClick={() => {
                onSwitchBranch(branch)
                onSetBranchSwitchOpen(false)
              }}
            >
              <span className="inline-flex items-center justify-center text-[color:var(--accent)]">
                {branch === currentBranch ? <Check size={14} /> : null}
              </span>
              <span
                className={cn(
                  'min-w-0 truncate',
                  appTypeControlClass,
                  branch === currentBranch ? appToneTextClass : appToneMutedClass,
                )}
              >
                {branch}
              </span>
            </button>
          ))
        ) : (
          <div className={cn('px-2 py-1.5', appTypeSmallClass, appToneMutedClass)}>
            Press Enter to check out “{branchSwitchInput.trim()}”
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        aria-label="Search branches"
        value={branchSwitchInput}
        onChange={(event) => onSetBranchSwitchInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submitBranchSwitch()
          if (event.key === 'Escape') onSetBranchSwitchOpen(false)
        }}
        className={composerPopoverInputClass}
        placeholder="Search branches"
      />
    </>
  )

  if (asChild) return asChild(content)

  return (
    <PopoverPanel
      surface={false}
      open={visible}
      id={panelId}
      ref={panelRef}
      data-open={visible ? 'true' : 'false'}
      role="dialog"
      aria-label="Branch selector"
      className={cn(
        composerPopoverPanelClass,
        'grid min-w-0 max-w-full grid-rows-[auto_minmax(0,1fr)_auto] gap-1.5 overflow-hidden',
        className,
      )}
      style={style}
    >
      {content}
    </PopoverPanel>
  )
}
