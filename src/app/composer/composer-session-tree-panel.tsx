import type { PiTreeFilterMode } from '@howcode/shared/desktop-settings-contracts'
import {
  appToneAccentClass,
  appToneMutedClass,
  appTypeMetaClass,
  inlineEmptyNoteClass,
} from '@howcode/ui'
import { useQuery } from '@tanstack/react-query'
import { type MutableRefObject, type RefObject, useEffect, useMemo, useState } from 'react'
import { PopoverPanel } from '../common/popover'
import { desktopQueryKeys, getSessionTreeListQuery } from '../query/desktop-query'
import { dispatchSessionTreePreview } from '../thread/session-tree-preview'
import { cn } from '../utils/cn'
import {
  getComposerSessionTreeRowsFromList,
  isComposerSessionTreePanelVisible,
} from './composer-session-tree'
import { getVisibleSessionTreeRowIndices, rowHasChildren } from './composer-session-tree-fold'
import { ComposerSessionTreeRowLine } from './composer-session-tree-row-line'
import { useComposerSessionTreeBrowse } from './useComposerSessionTreeBrowse'

const listboxId = 'composer-session-tree-listbox'

type ComposerSessionTreePanelProps = {
  panelRef: RefObject<HTMLDivElement | null>
  sessionPath?: string | null | undefined
  treeFilterMode?: PiTreeFilterMode | undefined
  open?: boolean | undefined
  forceHidden?: boolean | undefined
  navigateDisabled?: boolean | undefined
  onNavigate?:
    | ((entryId: string, summarize: boolean, label?: string) => Promise<boolean>)
    | undefined
  onRevealInThread?: ((entryId: string) => void) | undefined
  onBindClose?: ((close: (() => void) | null) => void) | undefined
  onNavigateConfirmOpenChange?: ((open: boolean) => void) | undefined
  cancelNavigateConfirmRef?: MutableRefObject<(() => void) | null> | undefined
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
  onBindClose,
  onNavigateConfirmOpenChange,
  cancelNavigateConfirmRef,
}: ComposerSessionTreePanelProps) {
  const visible = isComposerSessionTreePanelVisible(open, forceHidden)
  const persistedPath = sessionPath?.trim() ?? ''
  const { data: treeList = null } = useQuery({
    queryKey: desktopQueryKeys.sessionTreeList(persistedPath),
    queryFn: () => getSessionTreeListQuery(persistedPath),
    enabled: visible && persistedPath.length > 0,
    staleTime: 0,
  })

  const leafId = treeList?.leafId ?? null

  const rows = useMemo(
    () => getComposerSessionTreeRowsFromList(treeList ?? undefined, treeFilterMode),
    [treeList, treeFilterMode],
  )

  const {
    anchorEntryId,
    previewEntryId,
    focusEntryId,
    focusRow,
    restoreAnchorAndClearPreview,
    finishNavigate,
  } = useComposerSessionTreeBrowse({
    sessionTreeOpen: visible,
    leafIdFromList: leafId,
    onPreviewEntry: (entryId) => {
      if (!persistedPath) return
      dispatchSessionTreePreview({
        sessionPath: persistedPath,
        previewEntryId: entryId,
      })
    },
    onRestoreAnchorInThread: (entryId) => onRevealInThread?.(entryId),
  })

  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(() => new Set())
  const [confirmEntryId, setConfirmEntryId] = useState<string | null>(null)

  useEffect(() => {
    if (!visible) setConfirmEntryId(null)
  }, [visible])

  useEffect(() => {
    onNavigateConfirmOpenChange?.(confirmEntryId !== null)
  }, [confirmEntryId, onNavigateConfirmOpenChange])

  useEffect(() => {
    if (!cancelNavigateConfirmRef) return
    cancelNavigateConfirmRef.current = () => setConfirmEntryId(null)
    return () => {
      cancelNavigateConfirmRef.current = null
    }
  }, [cancelNavigateConfirmRef])

  useEffect(() => {
    if (!onBindClose) return
    const close = () => {
      restoreAnchorAndClearPreview()
    }
    onBindClose(close)
    return () => onBindClose(null)
  }, [onBindClose, restoreAnchorAndClearPreview])

  const visibleIndices = useMemo(
    () => getVisibleSessionTreeRowIndices(rows, collapsedIds),
    [rows, collapsedIds],
  )

  if (!visible) return null

  const focusIndex = rows.findIndex((row) => row.id === focusEntryId)

  const toggleCollapsed = (id: string) => {
    setCollapsedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const finishNavigateConfirm = async (entryId: string, summarize: boolean, label?: string) => {
    setConfirmEntryId(null)
    finishNavigate(entryId)
    await onNavigate?.(entryId, summarize, label)
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
          {previewEntryId ? (
            <span className={cn('ml-2', appToneAccentClass)}>Previewing</span>
          ) : null}
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
              const isAnchor = Boolean(anchorEntryId && row.id === anchorEntryId)
              const isPreviewing = Boolean(previewEntryId && row.id === previewEntryId)
              const canNavigate = Boolean(onNavigate && anchorEntryId && row.id !== anchorEntryId)
              return (
                <ComposerSessionTreeRowLine
                  key={row.id}
                  row={row}
                  selected={rowIndex === focusIndex}
                  isAnchor={isAnchor}
                  isPreviewing={isPreviewing}
                  hasChildren={hasChildren}
                  expanded={expanded}
                  navigateDisabled={navigateDisabled}
                  canNavigate={canNavigate}
                  confirmOpen={confirmEntryId === row.id}
                  onFocusRow={() => focusRow(row.id)}
                  onToggleExpand={() => toggleCollapsed(row.id)}
                  onOpenNavigateConfirm={() => setConfirmEntryId(row.id)}
                  onCancelNavigateConfirm={() => setConfirmEntryId(null)}
                  onNavigateWithoutSummary={(label) => finishNavigateConfirm(row.id, false, label)}
                  onNavigateWithSummary={(label) => finishNavigateConfirm(row.id, true, label)}
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
