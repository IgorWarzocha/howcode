import { Loader2, Search, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useHowcodeKeybindingCommand } from '../../../app-shell/keybinding-events'
import type { ThreadSearchMatch, ThreadSearchResult } from '../../../desktop/types'
import { searchThreadQuery } from '../../../query/desktop-query'
import { cn } from '../../../utils/cn'

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
    setOpen(false)
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
      close()
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [close, open])

  useHowcodeKeybindingCommand('thread.find', (event) => {
    event.preventDefault()
    openFind()
  })

  useEffect(() => {
    onQueryChange(open ? query : '')
    if (!(open && sessionPath && query.trim())) {
      setResult({ matches: [], searchedMessageCount: 0 })
      setSearching(false)
      onActiveMatchChange(null)
      return
    }

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setSearching(true)
    const timeout = window.setTimeout(() => {
      void searchThreadQuery(sessionPath, query)
        .then((nextResult) => {
          if (requestIdRef.current !== requestId) return
          setResult(nextResult)
          setSearching(false)
          setMatchIndex(0)
          onActiveMatchChange(null)
        })
        .catch(() => {
          if (requestIdRef.current !== requestId) return
          setResult({ matches: [], searchedMessageCount: 0 })
          setSearching(false)
          setMatchIndex(0)
          onActiveMatchChange(null)
        })
    }, 220)

    return () => window.clearTimeout(timeout)
  }, [onActiveMatchChange, onQueryChange, open, query, sessionPath])

  if (!open) return null

  const goToMatch = (direction: -1 | 1) => {
    if (matchCount === 0) return
    selectMatch((matchIndex + direction + matchCount) % matchCount)
  }

  return (
    <div className="absolute top-3 right-4 z-30 w-[28rem] overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--panel)] shadow-[var(--shadow)]">
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
          className="h-7 min-w-0 flex-1 bg-transparent px-1 text-[13px] text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted-2)]"
          aria-label="Find in thread"
        />
        {searching ? (
          <Loader2 size={13} className="animate-spin text-[color:var(--muted)]" />
        ) : null}
        <span
          className={cn(
            'min-w-14 text-center text-[11px]',
            query.trim() && !searching && matchCount === 0
              ? 'text-[color:var(--danger)]'
              : 'text-[color:var(--muted-2)]',
          )}
        >
          {query.trim() ? `${matchCount ? matchIndex + 1 : 0}/${matchCount}` : '—'}
        </span>
        <button
          type="button"
          className="rounded-md px-2 text-[12px] text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)]"
          onClick={() => goToMatch(-1)}
          aria-label="Previous match"
        >
          ↑
        </button>
        <button
          type="button"
          className="rounded-md px-2 text-[12px] text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)]"
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
            <div className="px-2 py-3 text-[12px] text-[color:var(--muted)]">Searching thread…</div>
          ) : matches.length > 0 ? (
            matches.map((match, index) => (
              <button
                key={`${match.messageId}:${match.matchStart}:${match.matchEnd}`}
                type="button"
                className="grid w-full gap-1 rounded-lg px-2 py-1.5 text-left text-[12px] text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] data-[active=true]:bg-[color:var(--accent-bg-subtle)] data-[active=true]:text-[color:var(--text)]"
                data-active={index === matchIndex ? 'true' : 'false'}
                onClick={() => selectMatch(index)}
              >
                <span className="text-[11px] uppercase tracking-[0.08em] text-[color:var(--muted-2)]">
                  {match.role}
                </span>
                <span className="line-clamp-2">
                  <HighlightedSnippet match={match} />
                </span>
              </button>
            ))
          ) : (
            <div className="px-2 py-3 text-[12px] text-[color:var(--muted)]">No matches</div>
          )}
        </div>
      ) : null}
    </div>
  )
}
