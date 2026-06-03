import type { PiTreeFilterMode } from '@howcode/shared/desktop-settings-contracts'
import {
  appToneAccentClass,
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
import { getSessionTreeListQuery } from '../query/desktop-query'
import { cn } from '../utils/cn'
import {
  type ComposerSessionTreeRow,
  composerSessionTreePanelDevAlwaysOpen,
  getComposerSessionTreeRowsFromList,
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

const sessionTreeKindColumnClass = 'w-[3rem] shrink-0'

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
  const indentPx = row.depth * 14
  const contentSurfaceClass = cn(
    'grid min-h-6 w-full min-w-0 grid-cols-[3rem_minmax(0,1fr)] items-center gap-1.5 rounded-md px-2 py-0 text-left transition-colors duration-150 ease-out',
    row.isLeaf && 'opacity-70',
    !row.isOnActivePath && 'opacity-55',
    selected
      ? cn(composerPopoverOptionSelectedClass, 'text-[color:var(--text)]')
      : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]',
  )

  return (
    <div
      className="grid w-full min-h-6 items-center gap-0.5"
      style={{ gridTemplateColumns: `${indentPx}px 1rem minmax(0,1fr)` }}
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
        id={`composer-session-tree-option-${row.id}`}
        type="button"
        role="option"
        aria-selected={selected}
        disabled={row.isLeaf}
        className={contentSurfaceClass}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onSelect(row.id)}
      >
        <span
          className={cn(
            sessionTreeKindColumnClass,
            'truncate',
            appTypeMetaClass,
            row.kind === 'branch' ? appToneAccentClass : appToneMutedClass,
          )}
        >
          {rowKindLabel(row.kind)}
        </span>
        <span
          className={cn(
            'min-w-0 truncate',
            appTypeSmallClass,
            row.kind === 'branch' ? appToneAccentClass : appToneTextClass,
          )}
        >
          {row.label}
        </span>
      </button>
    </div>
  )
}

type ComposerSessionTreePanelProps = {
  panelRef: RefObject<HTMLDivElement | null>
  sessionPath?: string | null | undefined
  treeFilterMode?: PiTreeFilterMode | undefined
  open?: boolean | undefined
  onSelectEntry?: ((entryId: string) => void) | undefined
}

export function ComposerSessionTreePanel({
  panelRef,
  sessionPath,
  treeFilterMode = 'no-tools',
  open = false,
  onSelectEntry,
}: ComposerSessionTreePanelProps) {
  const visible = open || composerSessionTreePanelDevAlwaysOpen
  const [treeList, setTreeList] =
    useState<Awaited<ReturnType<typeof getSessionTreeListQuery>>>(null)

  useEffect(() => {
    if (!(visible && sessionPath?.trim())) {
      setTreeList(null)
      return
    }
    let cancelled = false
    void getSessionTreeListQuery(sessionPath).then((list) => {
      if (!cancelled) setTreeList(list)
    })
    return () => {
      cancelled = true
    }
  }, [sessionPath, visible])

  const rows = useMemo(
    () => getComposerSessionTreeRowsFromList(treeList ?? undefined, treeFilterMode),
    [treeList, treeFilterMode],
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
      <div
        className={cn(
          'grid w-full max-h-72 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-t-lg rounded-b-none border border-[color:var(--border)] bg-[color:var(--panel)] shadow-none',
        )}
      >
        <div
          className={cn(
            'sticky top-0 z-[1] bg-[color:var(--panel-2)] px-2 py-1.5',
            appTypeMetaClass,
            appToneMutedClass,
          )}
        >
          Session tree
        </div>
        <PopoverPanel
          surface={false}
          ref={panelRef}
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          aria-label="Session tree"
          className="grid min-h-0 gap-0 overflow-y-auto overflow-x-hidden bg-[color:var(--panel)] px-2 py-1 shadow-none"
        >
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
    </div>
  )
}
