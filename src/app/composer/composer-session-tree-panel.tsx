import type { PiTreeFilterMode } from '@howcode/shared/desktop-settings-contracts'
import {
  appToneMutedClass,
  appToneTextClass,
  appTypeMetaClass,
  appTypeSmallClass,
  composerPopoverOptionSelectedClass,
  inlineEmptyNoteClass,
} from '@howcode/ui'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { type RefObject, useEffect, useMemo, useState } from 'react'
import { PopoverPanel } from '../common/popover'
import type { Message } from '../types'
import { cn } from '../utils/cn'
import {
  type ComposerSessionTreeRow,
  composerSessionTreePanelDevAlwaysOpen,
  getComposerSessionTreeRows,
} from './composer-session-tree'
import { getVisibleSessionTreeRowIndices, rowHasChildren } from './composer-session-tree-fold'

const listboxId = 'composer-session-tree-listbox'
const chevronSlotClass = 'inline-flex h-4 w-4 shrink-0 items-center justify-center'

function rowKindLabel(kind: ComposerSessionTreeRow['kind']) {
  switch (kind) {
    case 'user':
      return 'You'
    case 'assistant':
      return 'Agent'
    case 'tool':
      return 'Tool'
    case 'summary':
      return 'Summary'
    case 'system':
      return 'System'
    default:
      return 'Entry'
  }
}

function SessionTreeRowLine({
  row,
  selected,
  hasChildren,
  expanded,
  onToggleExpand,
  onSelect,
}: {
  row: ComposerSessionTreeRow
  selected: boolean
  hasChildren: boolean
  expanded: boolean
  onToggleExpand: () => void
  onSelect: (id: string) => void
}) {
  const indentPx = 4 + row.depth * 14

  return (
    <div
      className={cn(
        'grid w-full min-h-6 grid-cols-[1rem_minmax(0,1fr)] items-center gap-0.5 rounded-md py-0 pr-1 transition-colors duration-150 ease-out',
        row.isLeaf && 'opacity-70',
        !row.isOnActivePath && 'opacity-55',
        selected ? composerPopoverOptionSelectedClass : 'text-[color:var(--muted)]',
      )}
      style={{ paddingLeft: `${indentPx}px` }}
    >
      {hasChildren ? (
        <button
          type="button"
          className={cn(
            chevronSlotClass,
            'rounded-md text-[color:var(--muted)] transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]',
          )}
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
        id={`composer-session-tree-option-${row.id}`}
        type="button"
        role="option"
        aria-selected={selected}
        disabled={row.isLeaf}
        className={cn(
          'grid min-h-6 w-full min-w-0 grid-cols-[3rem_minmax(0,1fr)] items-center gap-1.5 rounded-md px-2 py-0 text-left transition-colors duration-150 ease-out',
          selected
            ? 'text-[color:var(--text)]'
            : 'hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]',
        )}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onSelect(row.id)}
      >
        <span className={cn('truncate', appTypeMetaClass, appToneMutedClass)}>
          {rowKindLabel(row.kind)}
        </span>
        <span className={cn('truncate', appTypeSmallClass, appToneTextClass)}>{row.label}</span>
      </button>
    </div>
  )
}

type ComposerSessionTreePanelProps = {
  panelRef: RefObject<HTMLDivElement | null>
  messages?: readonly Message[] | undefined
  treeFilterMode?: PiTreeFilterMode | undefined
  open?: boolean | undefined
  onSelectEntry?: ((entryId: string) => void) | undefined
}

export function ComposerSessionTreePanel({
  panelRef,
  messages,
  treeFilterMode = 'no-tools',
  open = false,
  onSelectEntry,
}: ComposerSessionTreePanelProps) {
  const visible = open || composerSessionTreePanelDevAlwaysOpen
  const rows = useMemo(
    () => getComposerSessionTreeRows(messages, treeFilterMode),
    [messages, treeFilterMode],
  )
  const leafId = useMemo(
    () => rows.find((row) => row.isLeaf)?.id ?? rows.at(-1)?.id ?? null,
    [rows],
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(() => new Set())

  useEffect(() => {
    setSelectedId(leafId)
  }, [leafId])

  const visibleIndices = useMemo(
    () => getVisibleSessionTreeRowIndices(rows, collapsedIds),
    [rows, collapsedIds],
  )

  if (!visible) return null

  const selectedIndex = rows.findIndex((row) => row.id === selectedId)

  const toggleCollapsed = (id: string) => {
    setCollapsedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="grid w-full overflow-visible px-4">
      <PopoverPanel
        surface={false}
        ref={panelRef}
        id={listboxId}
        role="listbox"
        tabIndex={-1}
        aria-label="Session tree"
        className={cn(
          'grid w-full max-h-72 gap-0 overflow-y-auto overflow-x-hidden rounded-t-lg rounded-b-none border border-[color:var(--border)] bg-[color:var(--panel)] px-2 py-1.5 shadow-none',
        )}
      >
        <div className={cn('pb-0.5 pl-0.5', appTypeMetaClass, appToneMutedClass)}>Session tree</div>
        {rows.length > 0 ? (
          visibleIndices.map((rowIndex) => {
            const row = rows[rowIndex]
            if (!row) return null
            const hasChildren = rowHasChildren(rows, rowIndex)
            const expanded = hasChildren && !collapsedIds.has(row.id)
            return (
              <SessionTreeRowLine
                key={row.id}
                row={row}
                selected={rowIndex === selectedIndex}
                hasChildren={hasChildren}
                expanded={expanded}
                onToggleExpand={() => toggleCollapsed(row.id)}
                onSelect={(id) => {
                  setSelectedId(id)
                  onSelectEntry?.(id)
                }}
              />
            )
          })
        ) : (
          <div className={inlineEmptyNoteClass}>No session entries</div>
        )}
      </PopoverPanel>
    </div>
  )
}
