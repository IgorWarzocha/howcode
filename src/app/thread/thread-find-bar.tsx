import { Loader2, Search, X } from 'lucide-react'
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import { useHowcodeKeybindingCommand } from '../app-shell/keybinding-events'
import type { ThreadSearchMatch, ThreadSearchResult } from '../desktop/types'
import { searchThreadQuery } from '../query/desktop-query'
import {
  appToneMutedClass,
  appToneSubtleClass,
  appToneTextClass,
  appTypeGroupTextClass,
  appTypeMetaClass,
  appTypeSmallClass,
} from '../ui/classes'
import { cn } from '../utils/cn'

type ThreadFindBarProps = {
  sessionPath?: string | null | undefined
  onActiveMatchChange: (match: ThreadSearchMatch | null) => void
  onQueryChange: (query: string) => void
}

function HighlightedSnippet({ match }: { match: ThreadSearchMatch }) {
  const before = match.snippet.slice(0, match.matchStart)
  const active = match.snippet.slice(match.matchStart, match.matchEnd)
  const after = match.snippet.slice(match.matchEnd)
  return (
    <>
      {before}
      <mark className="rounded bg-[color:var(--accent-bg-subtle)] px-0.5 text-[color:var(--accent)]">
        {active}
      </mark>
      {after}
    </>
  )
}

export function ThreadFindBar({
  sessionPath,
  onActiveMatchChange,
  onQueryChange,
}: ThreadFindBarProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<ThreadSearchResult>({ matches: [], searchedMessageCount: 0 })
  const [matchIndex, setMatchIndex] = useState(0)
  const [searching, setSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const requestIdRef = useRef(0)

  const matches = result.matches
  const matchCount = matches.length

  const close = useCallback(() => {
    requestIdRef.current += 1
    setOpen(false)
    setSearching(false)
    setResult({ matches: [], searchedMessageCount: 0 })
    setMatchIndex(0)
    onActiveMatchChange(null)
    onQueryChange('')
  }, [onActiveMatchChange, onQueryChange])

  const selectMatch = useCallback(
    (nextIndex: number) => {
      const match = matches[nextIndex] ?? null
      setMatchIndex(nextIndex)
      onActiveMatchChange(match)
    },
    [matches, onActiveMatchChange],
  )

  const openFind = useCallback(() => setOpen(true), [])
  const closeFind = useEffectEvent(close)
  const notifyQueryChange = useEffectEvent(onQueryChange)
  const notifyActiveMatchChange = useEffectEvent(onActiveMatchChange)

  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      closeFind()
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [open])

  useHowcodeKeybindingCommand('thread.find', (event) => {
    event.preventDefault()
    openFind()
  })

  useEffect(() => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    notifyQueryChange(open ? query : '')
    setMatchIndex(0)
    notifyActiveMatchChange(null)
    if (!(open && sessionPath && query.trim())) {
      setResult({ matches: [], searchedMessageCount: 0 })
      setSearching(false)
      return
    }

    setSearching(true)
    setResult({ matches: [], searchedMessageCount: 0 })
    const timeout = window.setTimeout(() => {
      void searchThreadQuery(sessionPath, query)
        .then((nextResult) => {
          if (requestIdRef.current !== requestId) return
          setResult(nextResult)
          setSearching(false)
          setMatchIndex(0)
          notifyActiveMatchChange(nextResult.matches[0] ?? null)
        })
        .catch(() => {
          if (requestIdRef.current !== requestId) return
          setResult({ matches: [], searchedMessageCount: 0 })
          setSearching(false)
          setMatchIndex(0)
          notifyActiveMatchChange(null)
        })
    }, 220)

    return () => window.clearTimeout(timeout)
  }, [open, query, sessionPath])

  if (!open) return null

  const goToMatch = (direction: -1 | 1) => {
    if (matchCount === 0) return
    selectMatch((matchIndex + direction + matchCount) % matchCount)
  }

  return (
    <div className="absolute top-3 right-4 z-30 w-[28rem] overflow-hidden rounded-xl bg-[color:var(--panel)]">
      <div className="flex items-center gap-1 p-1">
        <Search size={14} className="ml-2 text-[color:var(--muted)]" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              close()
            } else if (event.key === 'Enter') {
              event.preventDefault()
              goToMatch(event.shiftKey ? -1 : 1)
            }
          }}
          placeholder="Find in thread"
          className={cn(
            'h-7 min-w-0 flex-1 bg-transparent px-1 outline-none placeholder:text-[color:var(--muted-2)]',
            appTypeGroupTextClass,
            appToneTextClass,
          )}
          aria-label="Find in thread"
        />
        {searching ? (
          <Loader2 size={13} className="animate-spin text-[color:var(--muted)]" />
        ) : null}
        <span
          className={cn(
            'min-w-14 text-center',
            appTypeMetaClass,
            query.trim() && !searching && matchCount === 0
              ? 'text-[color:var(--danger)]'
              : 'text-[color:var(--muted-2)]',
          )}
        >
          {query.trim() ? `${matchCount ? matchIndex + 1 : 0}/${matchCount}` : '—'}
        </span>
        <button
          type="button"
          className={cn(
            'rounded-md px-2 hover:bg-[color:var(--surface-hover)]',
            appTypeSmallClass,
            appToneMutedClass,
          )}
          onClick={() => goToMatch(-1)}
          aria-label="Previous match"
        >
          ↑
        </button>
        <button
          type="button"
          className={cn(
            'rounded-md px-2 hover:bg-[color:var(--surface-hover)]',
            appTypeSmallClass,
            appToneMutedClass,
          )}
          onClick={() => goToMatch(1)}
          aria-label="Next match"
        >
          ↓
        </button>
        <button
          type="button"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)]"
          onClick={close}
          aria-label="Close thread find"
        >
          <X size={14} />
        </button>
      </div>
      {query.trim() ? (
        <div className="max-h-56 overflow-y-auto border-t border-[color:var(--border)] p-1">
          {searching ? (
            <div className={cn('px-2 py-3', appTypeSmallClass, appToneMutedClass)}>
              Searching thread…
            </div>
          ) : matches.length > 0 ? (
            matches.map((match, index) => (
              <button
                key={`${match.messageId}:${match.matchStart}:${match.matchEnd}`}
                type="button"
                className={cn(
                  'grid w-full gap-1 rounded-lg px-2 py-1.5 text-left hover:bg-[color:var(--surface-hover)] data-[active=true]:bg-[color:var(--accent-bg-subtle)] data-[active=true]:text-[color:var(--text)]',
                  appTypeSmallClass,
                  appToneMutedClass,
                )}
                data-active={index === matchIndex ? 'true' : 'false'}
                onClick={() => selectMatch(index)}
              >
                <span
                  className={cn(
                    'uppercase tracking-[0.08em]',
                    appTypeMetaClass,
                    appToneSubtleClass,
                  )}
                >
                  {match.role}
                </span>
                <span className="line-clamp-2">
                  <HighlightedSnippet match={match} />
                </span>
              </button>
            ))
          ) : (
            <div className={cn('px-2 py-3', appTypeSmallClass, appToneMutedClass)}>No matches</div>
          )}
        </div>
      ) : null}
    </div>
  )
}
