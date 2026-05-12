import {
  BrushCleaning,
  Check,
  Clock3,
  Inbox,
  ListFilter,
  Mail,
  Search,
  SquareTerminal,
  X,
} from 'lucide-react'
import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react'
import type { DesktopActionInvoker, InboxThread } from '../../../desktop/types'
import { useDismissibleLayer } from '../../../hooks/useDismissibleLayer'
import { EmptyStateCard } from '../../common/empty-state-card'
import { IconButton } from '../../common/icon-button'
import { SurfacePanel } from '../../common/surface-panel'
import { InboxThreadRow } from './inbox-thread-row'

type InboxFilterMode = 'all' | 'terminal' | 'recent'

type SidebarInboxSectionProps = {
  appLaunchedAtMs: number
  terminalRunningSessionPaths: ReadonlySet<string>
  threads: InboxThread[]
  selectedSessionPath: string | null
  onAction: DesktopActionInvoker
  onDismissThread: (thread: InboxThread) => void
  onSelectThread: (thread: InboxThread) => void
}

function matchesInboxFilter(
  thread: InboxThread,
  filterMode: InboxFilterMode,
  terminalRunningSessionPaths: ReadonlySet<string>,
  appLaunchedAtMs: number,
) {
  if (filterMode === 'terminal') return terminalRunningSessionPaths.has(thread.sessionPath)
  if (filterMode === 'recent') return (thread.lastActivityMs ?? 0) >= appLaunchedAtMs
  return true
}

function matchesInboxSearch(thread: InboxThread, normalizedQuery: string) {
  return [thread.title, thread.projectName, thread.preview ?? '']
    .join(' ')
    .toLowerCase()
    .includes(normalizedQuery)
}

function getInboxFilterIcon(filterMode: InboxFilterMode) {
  if (filterMode === 'terminal') return <SquareTerminal size={15} />
  return filterMode === 'recent' ? <Clock3 size={15} /> : <ListFilter size={15} />
}

function getInboxFilterLabel(filterMode: InboxFilterMode) {
  if (filterMode === 'terminal') return 'Show inbox threads with terminals'
  return filterMode === 'recent' ? 'Show inbox threads active since launch' : 'Filter inbox threads'
}

function getEmptyInboxMessage(showUnreadOnly: boolean, filterMode: InboxFilterMode) {
  if (showUnreadOnly) return 'No unread threads right now.'
  if (filterMode === 'terminal') return 'No inbox threads have a running terminal.'
  return filterMode === 'recent'
    ? 'No inbox threads have been active since launch.'
    : 'Nothing to catch up on yet.'
}

const inboxFilterItems: Array<{ id: InboxFilterMode; label: string; icon: ReactNode }> = [
  { id: 'all', label: 'All', icon: <Inbox size={14} /> },
  { id: 'terminal', label: 'Terminals', icon: <SquareTerminal size={14} /> },
  { id: 'recent', label: 'Since launch', icon: <Clock3 size={14} /> },
]

const inboxClearItems: Array<{ label: string; olderThanDays: number | null }> = [
  { label: 'Older than 1 day', olderThanDays: 1 },
  { label: 'Older than 7 days', olderThanDays: 7 },
  { label: 'Older than 30 days', olderThanDays: 30 },
  { label: 'All read items', olderThanDays: null },
]

function SidebarInboxFilterMenu({
  menuId,
  filterMode,
  panelRef,
  onSelect,
}: {
  menuId: string
  filterMode: InboxFilterMode
  panelRef: React.RefObject<HTMLDivElement | null>
  onSelect: (filterMode: InboxFilterMode) => void
}) {
  return (
    <SurfacePanel
      ref={panelRef}
      id={menuId}
      role="menu"
      aria-label="Inbox filters"
      data-open="true"
      className="sidebar-popover-panel sidebar-filter-menu motion-popover"
    >
      {inboxFilterItems.map((item) => {
        const selected = item.id === filterMode

        return (
          <button
            key={item.id}
            type="button"
            role="menuitemradio"
            aria-checked={selected}
            className="sidebar-filter-option"
            data-selected={selected ? 'true' : 'false'}
            onClick={() => onSelect(item.id)}
          >
            <span className="sidebar-filter-option__check">
              {selected ? <Check size={14} /> : null}
            </span>
            <span className="sidebar-filter-option__icon">{item.icon}</span>
            <span className="truncate text-left">{item.label}</span>
          </button>
        )
      })}
    </SurfacePanel>
  )
}

function SidebarInboxClearMenu({
  menuId,
  panelRef,
  onSelect,
}: {
  menuId: string
  panelRef: React.RefObject<HTMLDivElement | null>
  onSelect: (olderThanDays: number | null) => void
}) {
  return (
    <SurfacePanel
      ref={panelRef}
      id={menuId}
      role="menu"
      aria-label="Clear read inbox items"
      data-open="true"
      className="sidebar-popover-panel sidebar-filter-menu motion-popover"
    >
      {inboxClearItems.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          className="sidebar-filter-option sidebar-filter-option--compact"
          onClick={() => onSelect(item.olderThanDays)}
        >
          <span className="truncate text-left">{item.label}</span>
        </button>
      ))}
    </SurfacePanel>
  )
}

export function SidebarInboxSection({
  appLaunchedAtMs,
  terminalRunningSessionPaths,
  threads,
  selectedSessionPath,
  onAction,
  onDismissThread,
  onSelectThread,
}: SidebarInboxSectionProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [filterMode, setFilterMode] = useState<InboxFilterMode>('all')
  const [filterOpen, setFilterOpen] = useState(false)
  const clearButtonRef = useRef<HTMLButtonElement>(null)
  const clearPanelRef = useRef<HTMLDivElement>(null)
  const filterButtonRef = useRef<HTMLButtonElement>(null)
  const filterPanelRef = useRef<HTMLDivElement>(null)

  const dismissClear = useCallback(() => {
    setClearOpen(false)
  }, [])

  const dismissFilter = useCallback(() => {
    setFilterOpen(false)
  }, [])

  useDismissibleLayer({
    open: clearOpen,
    onDismiss: dismissClear,
    refs: [clearButtonRef, clearPanelRef],
  })

  useDismissibleLayer({
    open: filterOpen,
    onDismiss: dismissFilter,
    refs: [filterButtonRef, filterPanelRef],
  })

  const visibleThreads = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    return threads.filter((thread) => {
      if (showUnreadOnly && !thread.unread) return false
      if (normalizedQuery && !matchesInboxSearch(thread, normalizedQuery)) return false
      return matchesInboxFilter(thread, filterMode, terminalRunningSessionPaths, appLaunchedAtMs)
    })
  }, [
    appLaunchedAtMs,
    filterMode,
    searchQuery,
    showUnreadOnly,
    terminalRunningSessionPaths,
    threads,
  ])

  const filterIcon = getInboxFilterIcon(filterMode)
  const filterLabel = getInboxFilterLabel(filterMode)

  return (
    <section className="sidebar-section">
      <div className="sidebar-toolbar">
        <div
          className="sidebar-search-field"
          data-active={searchQuery.trim().length > 0 ? 'true' : 'false'}
        >
          <Search size={14} className="sidebar-search-icon" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Escape' || searchQuery.length === 0) return
              event.preventDefault()
              event.stopPropagation()
              setSearchQuery('')
            }}
            placeholder="Search inbox"
            className="sidebar-search-input"
            aria-label="Search inbox"
          />
          {searchQuery.length > 0 ? (
            <button
              type="button"
              className="sidebar-search-clear"
              aria-label="Clear inbox search"
              onClick={() => setSearchQuery('')}
            >
              <X size={13} />
            </button>
          ) : null}
        </div>

        <div className="sidebar-action-group">
          <IconButton
            ref={clearButtonRef}
            label="Clear read items"
            tooltipPlacement="right"
            icon={<BrushCleaning size={15} />}
            onClick={() => {
              setFilterOpen(false)
              setClearOpen((open) => !open)
            }}
            aria-haspopup="menu"
            aria-expanded={clearOpen}
            aria-controls="sidebar-inbox-clear-menu"
          />
          <IconButton
            ref={filterButtonRef}
            label={filterLabel}
            tooltipPlacement="right"
            icon={filterIcon}
            active={filterMode !== 'all'}
            onClick={() => {
              setClearOpen(false)
              setFilterOpen((open) => !open)
            }}
            aria-haspopup="menu"
            aria-expanded={filterOpen}
            aria-controls="sidebar-inbox-filter-menu"
          />
          <IconButton
            label="Show unread only"
            tooltipPlacement="right"
            icon={<Mail size={15} />}
            active={showUnreadOnly}
            onClick={() => setShowUnreadOnly((current) => !current)}
          />
        </div>

        {clearOpen ? (
          <SidebarInboxClearMenu
            menuId="sidebar-inbox-clear-menu"
            panelRef={clearPanelRef}
            onSelect={(olderThanDays) => {
              setClearOpen(false)
              void onAction('inbox.clear-read', { olderThanDays })
            }}
          />
        ) : null}

        {filterOpen ? (
          <SidebarInboxFilterMenu
            menuId="sidebar-inbox-filter-menu"
            filterMode={filterMode}
            panelRef={filterPanelRef}
            onSelect={(nextFilterMode) => {
              setFilterMode(nextFilterMode)
              setFilterOpen(false)
            }}
          />
        ) : null}
      </div>

      {visibleThreads.length > 0 ? (
        <div className="sidebar-scroll-region">
          <div className="sidebar-list">
            {visibleThreads.map((thread) => (
              <InboxThreadRow
                key={thread.sessionPath}
                age={thread.age}
                preview={thread.preview}
                projectName={thread.projectName}
                running={thread.running}
                terminalRunning={terminalRunningSessionPaths.has(thread.sessionPath)}
                selected={selectedSessionPath === thread.sessionPath}
                title={thread.title}
                unread={thread.unread}
                onDismiss={() => onDismissThread(thread)}
                onSelect={() => onSelectThread(thread)}
              />
            ))}
          </div>
        </div>
      ) : (
        <EmptyStateCard className="grid gap-1.5 px-3 py-4 text-center text-[12.5px] text-[color:var(--muted)]">
          <div className="text-[13px] text-[color:var(--text)]">No inbox items</div>
          <div>{getEmptyInboxMessage(showUnreadOnly, filterMode)}</div>
        </EmptyStateCard>
      )}
    </section>
  )
}
