import {
  appToneMutedClass,
  appToneTextClass,
  appTypeSmallClass,
  appTypeTinyClass,
  composerPopoverOptionClass,
  composerPopoverOptionSelectedClass,
  composerPopoverSectionLabelClass,
  inlineEmptyNoteClass,
} from '@howcode/ui'
import { GitBranch } from 'lucide-react'
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
        composerPopoverOptionClass,
        'grid min-h-8 grid-cols-[max-content_minmax(0,1fr)_max-content] items-center gap-2 py-1.5',
        row.isLeaf && 'opacity-70',
        !row.isOnActivePath && 'opacity-55',
        selected
          ? composerPopoverOptionSelectedClass
          : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]',
      )}
      style={{ paddingLeft: `${10 + row.depth * 14}px` }}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onSelect(row.id)}
    >
      <span className={cn('shrink-0 tabular-nums', appTypeTinyClass, appToneMutedClass)}>
        {rowKindLabel(row.kind)}
      </span>
      <span className={cn('min-w-0 truncate text-left', appTypeSmallClass, appToneTextClass)}>
        {row.label}
      </span>
      <span className={cn('shrink-0', appTypeTinyClass, appToneMutedClass)}>
        {row.isLeaf ? 'here' : row.isOnActivePath ? '' : 'alt'}
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
  const usingDevPreview = composerSessionTreePanelDevAlwaysOpen

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
        <div
          className={cn(
            composerPopoverSectionLabelClass,
            'flex items-center justify-between gap-2 pb-1',
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            <GitBranch size={12} className="shrink-0 opacity-80" aria-hidden />
            Session tree
          </span>
          {usingDevPreview ? (
            <span
              className={cn(appTypeTinyClass, 'normal-case tracking-normal', appToneMutedClass)}
            >
              Preview layout
            </span>
          ) : (
            <span
              className={cn(appTypeTinyClass, 'normal-case tracking-normal', appToneMutedClass)}
            >
              Active path
            </span>
          )}
        </div>
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
        <p className={cn('px-0.5 pt-1 pb-0.5', appTypeTinyClass, appToneMutedClass)}>
          Pick an earlier point, then summarize the branch you leave (navigation hooks next).
        </p>
      </PopoverPanel>
    </div>
  )
}

export function ComposerSessionTreeRail({
  buttonRef,
  onOpen,
}: {
  buttonRef: RefObject<HTMLButtonElement | null>
  onOpen: () => void
}) {
  return (
    <div className="pointer-events-none absolute bottom-[5.15rem] left-[1.1rem] z-[1]">
      <button
        ref={buttonRef}
        type="button"
        className="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]"
        onClick={onOpen}
        aria-label="Session tree"
        data-tooltip="Session tree"
      >
        <GitBranch size={15} />
      </button>
    </div>
  )
}
