import { Tooltip } from '@howcode/common/tooltip'
import {
  appToneAccentClass,
  appToneMutedClass,
  appToneTextClass,
  appTypeMetaClass,
  appTypeSmallClass,
  compactIconButtonClass,
  composerPopoverOptionSelectedClass,
} from '@howcode/ui'
import { Check, ChevronDown, ChevronRight, History } from 'lucide-react'
import { type MutableRefObject, useCallback, useEffect, useState } from 'react'
import { cn } from '../utils/cn'
import type { ComposerSessionTreeRow } from './composer-session-tree'
import { ComposerSessionTreeLabelPopover } from './composer-session-tree-label-popover'
import { ComposerSessionTreeNavigateConfirm } from './composer-session-tree-navigate-confirm'

const chevronSlotClass = 'inline-flex h-4 w-4 shrink-0 items-center justify-center'
const sessionTreeKindColumnClass = 'w-[3rem] shrink-0'

function rowKindLabel(row: ComposerSessionTreeRow) {
  if (row.customLabel) return row.customLabel
  const kind = row.kind
  switch (kind) {
    case 'user':
      return 'You'
    case 'assistant':
      return 'Agent'
    case 'tool':
      return 'Tool'
    case 'branch':
      return 'Branch'
    case 'summary':
      return 'Compact'
    case 'system':
      return 'System'
    default:
      return 'Entry'
  }
}

function SessionTreeEntryText({ row }: { row: ComposerSessionTreeRow }) {
  return (
    <span
      className={cn(
        'min-w-0 truncate',
        appTypeSmallClass,
        row.kind === 'branch' ? appToneAccentClass : appToneTextClass,
      )}
    >
      {row.label}
    </span>
  )
}

function sessionTreeRowAriaLabel(isAnchor: boolean, isPreviewing: boolean) {
  if (isAnchor) return 'Current position in session'
  if (isPreviewing) return 'Previewing this point in the thread'
  return 'Preview this point in the thread'
}

function SessionTreeAnchorMark() {
  return (
    <Tooltip content="Current position (session anchor)" placement="right">
      <span
        className="composer-session-tree-anchor-mark inline-flex h-5 w-5 items-center justify-center text-[color:var(--accent)]"
        role="img"
        aria-label="Current position in session"
      >
        <Check size={14} strokeWidth={2.5} aria-hidden />
      </span>
    </Tooltip>
  )
}

function SessionTreeNavigateTrigger({
  navigateDisabled,
  onOpenNavigateConfirm,
}: {
  navigateDisabled: boolean
  onOpenNavigateConfirm: () => void
}) {
  return (
    <Tooltip content="Go to this point in the session" placement="top">
      <button
        type="button"
        className={cn(
          compactIconButtonClass,
          'composer-session-tree-nav-trigger sidebar-icon-action sidebar-icon-action--sm h-5 w-5 border-transparent bg-transparent text-[color:var(--muted)]',
        )}
        disabled={navigateDisabled}
        aria-label="Go to this point in the session"
        onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => {
          event.stopPropagation()
          if (navigateDisabled) return
          onOpenNavigateConfirm()
        }}
      >
        <History size={12} />
      </button>
    </Tooltip>
  )
}

export function ComposerSessionTreeRowLine({
  row,
  selected,
  isAnchor,
  isPreviewing,
  hasChildren,
  expanded,
  navigateDisabled,
  canNavigate,
  confirmOpen,
  onToggleExpand,
  onFocusRow,
  onOpenNavigateConfirm,
  onCancelNavigateConfirm,
  onNavigateWithoutSummary,
  onNavigateWithSummary,
  onLabelEntry,
  onLabelPopoverOpenChange,
  cancelLabelPopoverRef,
}: {
  row: ComposerSessionTreeRow
  selected: boolean
  isAnchor: boolean
  isPreviewing: boolean
  hasChildren: boolean
  expanded: boolean
  navigateDisabled: boolean
  canNavigate: boolean
  confirmOpen: boolean
  onToggleExpand: () => void
  onFocusRow: () => void
  onOpenNavigateConfirm: () => void
  onCancelNavigateConfirm: () => void
  onNavigateWithoutSummary: (label?: string) => void
  onNavigateWithSummary: (label?: string) => void
  onLabelEntry: (entryId: string, label: string) => Promise<boolean> | boolean
  onLabelPopoverOpenChange?: ((open: boolean) => void) | undefined
  cancelLabelPopoverRef?: MutableRefObject<(() => void) | null> | undefined
}) {
  const [labelPopoverOpen, setLabelPopoverOpen] = useState(false)
  const setLabelPopoverOpenState = useCallback(
    (open: boolean) => {
      setLabelPopoverOpen(open)
      onLabelPopoverOpenChange?.(open)
    },
    [onLabelPopoverOpenChange],
  )

  useEffect(() => {
    if (!(cancelLabelPopoverRef && labelPopoverOpen)) return
    cancelLabelPopoverRef.current = () => setLabelPopoverOpenState(false)
    return () => {
      cancelLabelPopoverRef.current = null
    }
  }, [cancelLabelPopoverRef, labelPopoverOpen, setLabelPopoverOpenState])
  const indentPx = row.depth * 14
  const contentSurfaceClass = cn(
    'composer-session-tree-label-button grid min-h-6 w-full min-w-0 grid-cols-[3rem_minmax(0,1fr)] items-center gap-1.5 rounded-md px-2 py-0 text-left transition-colors duration-150 ease-out',
    row.isLeaf && !isAnchor && !isPreviewing && 'opacity-70',
    !(row.isOnActivePath || isPreviewing) && 'opacity-55',
    isPreviewing && 'composer-session-tree-row--preview',
    'cursor-pointer hover:bg-[color:var(--panel-2)]',
    selected
      ? cn(composerPopoverOptionSelectedClass, 'text-[color:var(--text)]')
      : 'text-[color:var(--muted)]',
  )

  return (
    <div
      className="composer-session-tree-row grid w-full min-h-6 items-center gap-0.5"
      data-can-navigate={canNavigate ? 'true' : 'false'}
      style={{ gridTemplateColumns: `${indentPx}px 1rem minmax(0,1fr) 1.5rem` }}
    >
      <span aria-hidden />
      {hasChildren ? (
        <button
          type="button"
          className={cn(chevronSlotClass, 'text-[color:var(--muted)]')}
          aria-label={expanded ? 'Collapse subtree' : 'Expand subtree'}
          aria-expanded={expanded}
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            event.stopPropagation()
            onToggleExpand()
          }}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
      ) : (
        <span className={chevronSlotClass} aria-hidden />
      )}
      <button
        type="button"
        className={contentSurfaceClass}
        aria-label={sessionTreeRowAriaLabel(isAnchor, isPreviewing)}
        onMouseDown={(event) => event.preventDefault()}
        onMouseMove={(event) => {
          const target = event.target
          if (
            target instanceof Element &&
            target.closest('.composer-session-tree-entry-label-anchor')
          ) {
            setLabelPopoverOpenState(true)
          }
        }}
        onClick={() => onFocusRow()}
      >
        <ComposerSessionTreeLabelPopover
          entryId={row.id}
          label={row.customLabel}
          open={labelPopoverOpen}
          onLabel={onLabelEntry}
          onOpenChange={setLabelPopoverOpenState}
        >
          <span
            className={cn(
              sessionTreeKindColumnClass,
              'truncate',
              appTypeMetaClass,
              row.customLabel || row.kind === 'branch' ? appToneAccentClass : appToneMutedClass,
            )}
            title={row.customLabel}
          >
            {rowKindLabel(row)}
          </span>
        </ComposerSessionTreeLabelPopover>
        <SessionTreeEntryText row={row} />
      </button>
      <span className="composer-session-tree-meta-slot">
        {isAnchor ? <SessionTreeAnchorMark /> : null}
        {canNavigate ? (
          <ComposerSessionTreeNavigateConfirm
            open={confirmOpen}
            onCancel={onCancelNavigateConfirm}
            onNavigateWithoutSummary={onNavigateWithoutSummary}
            onNavigateWithSummary={onNavigateWithSummary}
            trigger={
              <SessionTreeNavigateTrigger
                navigateDisabled={navigateDisabled}
                onOpenNavigateConfirm={onOpenNavigateConfirm}
              />
            }
          />
        ) : null}
      </span>
    </div>
  )
}
