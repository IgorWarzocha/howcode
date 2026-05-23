import { Check, GitFork, GitPullRequestDraft } from 'lucide-react'
import type { CSSProperties, ReactNode, RefObject } from 'react'
import { PopoverPanel } from '../../components/common/popover'
import {
  getFeatureStatusBadgeClass,
  getFeatureStatusDataAttributes,
} from '../../features/feature-status'
import {
  appToneMutedClass,
  appToneTextClass,
  appTypeControlClass,
  appTypeMetaClass,
  appTypeSmallClass,
  composerPopoverInputClass,
  composerPopoverOptionClass,
  composerPopoverOptionSelectedClass,
  composerPopoverPanelClass,
  composerPopoverSectionLabelClass,
} from '../../ui/classes'
import { cn } from '../../utils/cn'

type BranchSwitchPopoverProps = {
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
        'grid min-w-0 max-w-full grid-rows-[auto_minmax(0,1fr)_auto_auto_auto] gap-1.5 overflow-hidden',
        className,
      )}
      style={style}
    >
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
                {branch === currentBranch ? <Check size={13} /> : null}
              </span>
              <span
                className={cn(
                  'min-w-0 truncate',
                  branch === currentBranch
                    ? 'text-[color:var(--text)]'
                    : 'text-[color:var(--muted)]',
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
        value={branchSwitchInput}
        onChange={(event) => onSetBranchSwitchInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submitBranchSwitch()
          if (event.key === 'Escape') onSetBranchSwitchOpen(false)
        }}
        className={composerPopoverInputClass}
        placeholder="Search branches"
      />
      <MockBranchPanel
        featureId="feature:composer.repo-selector"
        icon={<GitFork size={14} />}
        title="Repository"
        description="Selector will live here instead of the removed top bar."
        actions={['origin', 'Switch repo']}
      />
      <MockBranchPanel
        featureId="feature:composer.worktrees"
        icon={<GitPullRequestDraft size={14} />}
        title="Worktrees"
        description="Reserved for linked branch workspaces."
        actions={['Create worktree', 'Open existing']}
      />
    </PopoverPanel>
  )
}

function MockBranchPanel({
  actions,
  description,
  featureId,
  icon,
  title,
}: {
  actions: readonly [string, string]
  description: string
  featureId: 'feature:composer.repo-selector' | 'feature:composer.worktrees'
  icon: ReactNode
  title: string
}) {
  return (
    <div
      className="grid min-h-[82px] min-w-0 max-w-full gap-2 overflow-hidden rounded-lg bg-[color:var(--surface-hover)] p-2.5"
      {...getFeatureStatusDataAttributes(featureId)}
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[color:var(--panel)] text-[color:var(--muted)]">
            {icon}
          </span>
          <div className="min-w-0">
            <div className={cn('truncate', appTypeControlClass, appToneTextClass)}>{title}</div>
            <div className={cn('truncate', appTypeMetaClass, appToneMutedClass)}>{description}</div>
          </div>
        </div>
        <span className={getFeatureStatusBadgeClass(featureId)}>Mock</span>
      </div>
      <div className={cn('grid min-w-0 grid-cols-2 gap-1.5', appTypeMetaClass, appToneMutedClass)}>
        {actions.map((action) => (
          <div
            key={action}
            className="min-w-0 truncate rounded-md bg-[color:var(--panel)] px-2 py-1.5"
          >
            {action}
          </div>
        ))}
      </div>
    </div>
  )
}
