import { Clock3, ListFilter, Search, SquareTerminal } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { InboxThread } from '../../../desktop/types'
import { EmptyStateCard } from '../../common/empty-state-card'
import { IconButton } from '../../common/icon-button'
import { InboxThreadRow } from './inbox-thread-row'

type SidebarInboxSectionProps = {
  appLaunchedAtMs: number
  terminalRunningSessionPaths: ReadonlySet<string>
  threads: InboxThread[]
  selectedSessionPath: string | null
  onDismissThread: (thread: InboxThread) => void
  onSelectThread: (thread: InboxThread) => void
}

function getNextInboxFilterMode(current: 'all' | 'terminal' | 'recent') {
  if (current === 'all') return 'terminal'
  return current === 'terminal' ? 'recent' : 'all'
}

function matchesInboxFilter(
  thread: InboxThread,
  filterMode: 'all' | 'terminal' | 'recent',
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

function getInboxFilterIcon(filterMode: 'all' | 'terminal' | 'recent') {
  if (filterMode === 'terminal') return <SquareTerminal size={15} />
  return filterMode === 'recent' ? <Clock3 size={15} /> : <ListFilter size={15} />
}

function getInboxFilterLabel(filterMode: 'all' | 'terminal' | 'recent') {
  if (filterMode === 'terminal') return 'Show inbox threads with terminals'
  return filterMode === 'recent' ? 'Show inbox threads active since launch' : 'Filter inbox threads'
}

function getEmptyInboxMessage(showUnreadOnly: boolean, filterMode: 'all' | 'terminal' | 'recent') {
  if (showUnreadOnly) return 'No unread threads right now.'
  if (filterMode === 'terminal') return 'No inbox threads have a running terminal.'
  return filterMode === 'recent'
    ? 'No inbox threads have been active since launch.'
    : 'Nothing to catch up on yet.'
}

export function SidebarInboxSection({
  appLaunchedAtMs,
  terminalRunningSessionPaths,
  threads,
  selectedSessionPath,
  onDismissThread,
  onSelectThread,
}: SidebarInboxSectionProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const [filterMode, setFilterMode] = useState<'all' | 'terminal' | 'recent'>('all')

  const cycleFilterMode = () => setFilterMode(getNextInboxFilterMode)

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
        <label
          className="sidebar-search-field"
          data-active={searchQuery.trim().length > 0 ? 'true' : 'false'}
        >
          <Search size={14} className="sidebar-search-icon" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search inbox"
            className="sidebar-search-input"
            aria-label="Search inbox"
          />
        </label>

        <div className="sidebar-action-group">
          <IconButton
            label={filterLabel}
            tooltipPlacement="right"
            icon={filterIcon}
            active={filterMode !== 'all'}
            onClick={cycleFilterMode}
          />
          <IconButton
            label="Show unread only"
            tooltipPlacement="right"
            icon={<ListFilter size={15} />}
            active={showUnreadOnly}
            onClick={() => setShowUnreadOnly((current) => !current)}
          />
        </div>
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
