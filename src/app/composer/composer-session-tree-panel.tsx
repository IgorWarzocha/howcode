import { Tooltip } from '@howcode/common/tooltip'
import type { PiTreeFilterMode } from '@howcode/shared/desktop-settings-contracts'
import {
  appToneAccentClass,
  appToneMutedClass,
  appToneTextClass,
  appTypeMetaClass,
  appTypeSmallClass,
  compactIconButtonClass,
  composerPopoverOptionSelectedClass,
  inlineEmptyNoteClass,
} from '@howcode/ui'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, History } from 'lucide-react'
import { type RefObject, useEffect, useMemo, useState } from 'react'
import { PopoverPanel } from '../common/popover'
import { desktopQueryKeys, getSessionTreeListQuery } from '../query/desktop-query'
import { cn } from '../utils/cn'
import {
  type ComposerSessionTreeRow,
  getComposerSessionTreeRowsFromList,
  isComposerSessionTreePanelVisible,
} from './composer-session-tree'
import { getVisibleSessionTreeRowIndices, rowHasChildren } from './composer-session-tree-fold'
import { ComposerSessionTreeNavigateConfirm } from './composer-session-tree-navigate-confirm'

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
  navigateDisabled,
  canNavigate,
  canRevealInThread,
  confirmOpen,
  onToggleExpand,
  onRevealInThread,
  onOpenNavigateConfirm,
  onCancelNavigateConfirm,
  onNavigateWithoutSummary,
  onNavigateWithSummary,
}: {
  row: ComposerSessionTreeRow
  selected: boolean
  hasChildren: boolean
  expanded: boolean
  navigateDisabled: boolean
  canNavigate: boolean
  canRevealInThread: boolean
  confirmOpen: boolean
  onToggleExpand: () => void
  onRevealInThread?: (() => void) | undefined
  onOpenNavigateConfirm: () => void
  onCancelNavigateConfirm: () => void
  onNavigateWithoutSummary: () => void
  onNavigateWithSummary: () => void
}) {
  const indentPx = row.depth * 14
  const contentSurfaceClass = cn(
    'composer-session-tree-label-button grid min-h-6 w-full min-w-0 grid-cols-[3rem_minmax(0,1fr)] items-center gap-1.5 rounded-md px-2 py-0 text-left transition-colors duration-150 ease-out',
    row.isLeaf && !canRevealInThread && 'opacity-70',
    !row.isOnActivePath && 'opacity-55',
    canRevealInThread && 'cursor-pointer hover:bg-[color:var(--panel-2)]',
    selected
      ? cn(composerPopoverOptionSelectedClass, 'text-[color:var(--text)]')
      : 'text-[color:var(--muted)]',
  )
  const labelBody = (
    <>
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
    </>
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
      {canRevealInThread ? (
        <button
          type="button"
          className={contentSurfaceClass}
          aria-label="Show in thread"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onRevealInThread?.()}
        >
          {labelBody}
        </button>
      ) : (
        <div className={contentSurfaceClass} role="presentation">
          {labelBody}
        </div>
      )}
      <span className="composer-session-tree-meta-slot">
        {canNavigate ? (
          <ComposerSessionTreeNavigateConfirm
            open={confirmOpen}
            onCancel={onCancelNavigateConfirm}
            onNavigateWithoutSummary={onNavigateWithoutSummary}
            onNavigateWithSummary={onNavigateWithSummary}
            trigger={
              <Tooltip content="Go to this point in the session" placement="right">
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
            }
          />
        ) : null}
      </span>
    </div>
  )
}

type ComposerSessionTreePanelProps = {
  panelRef: RefObject<HTMLDivElement | null>
  sessionPath?: string | null | undefined
  treeFilterMode?: PiTreeFilterMode | undefined
  open?: boolean | undefined
  forceHidden?: boolean | undefined
  navigateDisabled?: boolean | undefined
  onNavigate?: ((entryId: string, summarize: boolean) => void) | undefined
  onRevealInThread?: ((entryId: string) => void) | undefined
}

export function ComposerSessionTreePanel({
  panelRef,
  sessionPath,
  treeFilterMode = 'no-tools',
  open = false,
  forceHidden = false,
  navigateDisabled = false,
  onNavigate,
  onRevealInThread,
}: ComposerSessionTreePanelProps) {
  const visible = isComposerSessionTreePanelVisible(open, forceHidden)
  const persistedPath = sessionPath?.trim() ?? ''
  const { data: treeList = null } = useQuery({
    queryKey: desktopQueryKeys.sessionTreeList(persistedPath),
    queryFn: () => getSessionTreeListQuery(persistedPath),
    enabled: visible && persistedPath.length > 0,
    staleTime: 0,
  })

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
  const [confirmEntryId, setConfirmEntryId] = useState<string | null>(null)

  useEffect(() => {
    setSelectedId(leafId)
  }, [leafId])

  useEffect(() => {
    if (!visible) setConfirmEntryId(null)
  }, [visible])

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

  const finishNavigate = (entryId: string, summarize: boolean) => {
    setConfirmEntryId(null)
    setSelectedId(entryId)
    onNavigate?.(entryId, summarize)
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
              const canNavigate = Boolean(onNavigate && leafId && row.id !== leafId)
              const canRevealInThread = Boolean(onRevealInThread && row.isOnActivePath)
              return (
                <SessionTreeRowLine
                  key={row.id}
                  row={row}
                  selected={rowIndex === selectedIndex}
                  hasChildren={hasChildren}
                  expanded={expanded}
                  navigateDisabled={navigateDisabled}
                  canNavigate={canNavigate}
                  canRevealInThread={canRevealInThread}
                  confirmOpen={confirmEntryId === row.id}
                  onRevealInThread={
                    canRevealInThread
                      ? () => {
                          setSelectedId(row.id)
                          onRevealInThread?.(row.id)
                        }
                      : undefined
                  }
                  onToggleExpand={() => toggleCollapsed(row.id)}
                  onOpenNavigateConfirm={() => setConfirmEntryId(row.id)}
                  onCancelNavigateConfirm={() => setConfirmEntryId(null)}
                  onNavigateWithoutSummary={() => finishNavigate(row.id, false)}
                  onNavigateWithSummary={() => finishNavigate(row.id, true)}
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
