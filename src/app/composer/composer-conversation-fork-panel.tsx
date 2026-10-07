import { useQuery } from '@tanstack/react-query'
import { type RefObject, useEffect, useRef, useState } from 'react'
import { PopoverPanel } from '../common/popover'
import { useDismissibleLayer } from '../hooks/useDismissibleLayer'
import { desktopQueryKeys, getConversationEntriesQuery } from '../query/desktop-query'
import {
  appToneMutedClass,
  appTypeMetaClass,
  appTypeSmallClass,
  composerOverlayPanelInsetClass,
  inlineEmptyNoteClass,
} from '../ui/classes'
import { cn } from '../utils/cn'

export function ComposerConversationForkPanel({
  panelRef,
  conversationId,
  open,
  forkDisabled,
  onFork,
  onClose,
  topRounded = true,
}: {
  panelRef: RefObject<HTMLDivElement | null>
  conversationId?: string | null | undefined
  open: boolean
  forkDisabled: boolean
  onFork: (entryId: string) => Promise<boolean>
  onClose: () => void
  topRounded?: boolean | undefined
}) {
  const persistedId = conversationId?.trim() ?? ''
  const { data, isPending, error } = useQuery({
    queryKey: desktopQueryKeys.conversationEntries(persistedId),
    queryFn: () => getConversationEntriesQuery(persistedId),
    enabled: open && persistedId.length > 0,
    staleTime: 0,
  })
  const [pendingEntryId, setPendingEntryId] = useState<string | null>(null)
  const pendingRef = useRef(false)
  useDismissibleLayer({ open, onDismiss: onClose, refs: [panelRef] })
  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement
    panelRef.current?.focus()
    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
    }
  }, [open, panelRef])
  if (!open) return null

  const fork = async (entryId: string) => {
    if (pendingRef.current || forkDisabled) return
    pendingRef.current = true
    setPendingEntryId(entryId)
    try {
      await onFork(entryId)
    } finally {
      pendingRef.current = false
      setPendingEntryId(null)
    }
  }

  return (
    <div className={cn('grid w-full overflow-visible', composerOverlayPanelInsetClass)}>
      <div
        className={cn(
          topRounded ? 'rounded-t-lg' : 'rounded-t-none',
          'grid max-h-72 grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-[color:var(--panel)] outline outline-1 -outline-offset-1 outline-[color:var(--border)]',
        )}
      >
        <div
          className={cn('bg-[color:var(--panel-2)] px-3 py-2', appTypeMetaClass, appToneMutedClass)}
        >
          Fork conversation
        </div>
        <PopoverPanel
          surface={false}
          ref={panelRef}
          tabIndex={-1}
          aria-label="Fork conversation"
          className="grid min-h-0 gap-1 overflow-y-auto px-3 py-2"
        >
          <p className={cn(appTypeSmallClass, appToneMutedClass)}>
            Start a new conversation from an entry. This conversation stays unchanged.
          </p>
          {error ? (
            <p role="alert" className={inlineEmptyNoteClass}>
              Could not load conversation entries.
            </p>
          ) : isPending ? (
            <p className={inlineEmptyNoteClass}>Loading entries…</p>
          ) : data?.entries.length ? (
            <ol className="grid gap-1">
              {data.entries.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-[color:var(--surface-hover)] disabled:opacity-50',
                      appTypeSmallClass,
                    )}
                    disabled={forkDisabled || pendingEntryId !== null}
                    aria-label={`Fork from ${entry.role}: ${entry.preview}`}
                    onClick={() => void fork(entry.id)}
                  >
                    <span className="min-w-0 flex-1 break-words">
                      <span className={appToneMutedClass}>{entry.role}: </span>
                      {entry.preview}
                    </span>
                    <span className={cn('shrink-0', appToneMutedClass)}>
                      {pendingEntryId === entry.id ? 'Forking…' : 'Fork'}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className={inlineEmptyNoteClass}>No conversation entries</p>
          )}
        </PopoverPanel>
      </div>
    </div>
  )
}
