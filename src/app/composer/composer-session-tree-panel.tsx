import {
  appToneMutedClass,
  appToneTextClass,
  appTypeControlClass,
  appTypeSmallClass,
  appTypeTinyClass,
  composerPopoverOptionSelectedClass,
  inlineEmptyNoteClass,
} from '@howcode/ui'
import { type RefObject, useEffect, useMemo, useState } from 'react'
import { PopoverPanel } from '../common/popover'
import type { Message } from '../types'
import { cn } from '../utils/cn'
import {
  type ComposerSessionTreeRow,
  composerSessionTreePanelDevAlwaysOpen,
  getComposerSessionTreeRows,
} from './composer-session-tree'

const listboxId = 'composer-session-tree-listbox'

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

function SessionTreeRowButton({
  row,
  selected,
  onSelect,
}: {
  row: ComposerSessionTreeRow
  selected: boolean
  onSelect: (id: string) => void
}) {
  return (
    <button
      id={`composer-session-tree-option-${row.id}`}
      type="button"
      role="option"
      aria-selected={selected}
      disabled={row.isLeaf}
      className={cn(
        'flex w-full min-h-8 items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors duration-150 ease-out',
        appTypeControlClass,
        row.isLeaf && 'opacity-70',
        !row.isOnActivePath && 'opacity-55',
        selected
          ? composerPopoverOptionSelectedClass
          : cn(
              appToneMutedClass,
              'hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]',
            ),
      )}
      style={{ paddingLeft: `${10 + row.depth * 14}px` }}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onSelect(row.id)}
    >
      <span className={cn('w-[3.25rem] shrink-0 self-center', appTypeTinyClass, appToneMutedClass)}>
        {rowKindLabel(row.kind)}
      </span>
      <span className={cn('min-w-0 truncate self-center', appTypeSmallClass, appToneTextClass)}>
        {row.label}
      </span>
    </button>
  )
}

type ComposerSessionTreePanelProps = {
  panelRef: RefObject<HTMLDivElement | null>
  messages?: readonly Message[] | undefined
  open?: boolean | undefined
  onSelectEntry?: ((entryId: string) => void) | undefined
}

export function ComposerSessionTreePanel({
  panelRef,
  messages,
  open = false,
  onSelectEntry,
}: ComposerSessionTreePanelProps) {
  const visible = open || composerSessionTreePanelDevAlwaysOpen
  const rows = useMemo(() => getComposerSessionTreeRows(messages), [messages])
  const leafId = useMemo(
    () => rows.find((row) => row.isLeaf)?.id ?? rows.at(-1)?.id ?? null,
    [rows],
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    setSelectedId(leafId)
  }, [leafId])

  if (!visible) return null

  const selectedIndex = rows.findIndex((row) => row.id === selectedId)

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
          'grid w-full max-h-72 gap-1 overflow-y-auto overflow-x-hidden rounded-t-lg rounded-b-none border border-[color:var(--border)] bg-[color:var(--panel)] px-2.5 py-2 shadow-none',
        )}
      >
        <div className={cn('pl-0.5 pb-1', appTypeSmallClass, appToneMutedClass)}>Session tree</div>
        {rows.length > 0 ? (
          rows.map((row, index) => (
            <SessionTreeRowButton
              key={row.id}
              row={row}
              selected={index === selectedIndex}
              onSelect={(id) => {
                setSelectedId(id)
                onSelectEntry?.(id)
              }}
            />
          ))
        ) : (
          <div className={inlineEmptyNoteClass}>No session entries</div>
        )}
      </PopoverPanel>
    </div>
  )
}
