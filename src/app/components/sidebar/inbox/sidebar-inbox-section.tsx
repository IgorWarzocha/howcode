import { PopoverPanel } from '@howaboua/howcode-sdk/common/popover'
import { useDismissibleLayer } from '@howaboua/howcode-sdk/hooks/useDismissibleLayer'
import {
  appToneMutedClass,
  appToneTextClass,
  appTypeControlClass,
  appTypeGroupTextClass,
} from '@howaboua/howcode-sdk/ui/typography-scale'
import { cn } from '@howaboua/howcode-sdk/utils/cn'
import { EmptyStateCard } from '@howcode/common/empty-state-card'
import { IconButton } from '@howcode/common/icon-button'
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
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useHowcodeKeybindingCommand } from '../../../app-shell/keybinding-events'
import type { DesktopActionInvoker, InboxChat } from '../../../desktop/types'
import { InboxChatRow } from './inbox-chat-row'

type InboxFilterMode = 'all' | 'terminal' | 'recent'

type SidebarInboxSectionProps = {
  appLaunchedAtMs: number
  terminalRunningConversationIds: ReadonlySet<string>
  chats: InboxChat[]
  selectedConversationId: string | null
  onAction: DesktopActionInvoker
  onDismissChat: (chat: InboxChat) => void
  onSelectChat: (chat: InboxChat) => void
}

function matchesInboxFilter(
  chat: InboxChat,
  filterMode: InboxFilterMode,
  terminalRunningConversationIds: ReadonlySet<string>,
  appLaunchedAtMs: number,
) {
  if (filterMode === 'terminal') return terminalRunningConversationIds.has(chat.conversationId)
  if (filterMode === 'recent') return (chat.lastActivityMs ?? 0) >= appLaunchedAtMs
  return true
}

function matchesInboxSearch(chat: InboxChat, normalizedQuery: string) {
  return [chat.title, chat.directoryName, chat.preview ?? '']
    .join(' ')
    .toLowerCase()
    .includes(normalizedQuery)
}

function getInboxFilterIcon(filterMode: InboxFilterMode) {
  if (filterMode === 'terminal') return <SquareTerminal size={15} />
  return filterMode === 'recent' ? <Clock3 size={15} /> : <ListFilter size={15} />
}

function getInboxFilterLabel(filterMode: InboxFilterMode) {
  if (filterMode === 'terminal') return 'Show inbox chats with terminals'
  return filterMode === 'recent' ? 'Show inbox chats active since launch' : 'Filter inbox chats'
}

function getEmptyInboxMessage(showUnreadOnly: boolean, filterMode: InboxFilterMode) {
  if (showUnreadOnly) return 'No unread chats right now.'
  if (filterMode === 'terminal') return 'No inbox chats have a running terminal.'
  return filterMode === 'recent'
    ? 'No inbox chats have been active since launch.'
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
    <PopoverPanel
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
    </PopoverPanel>
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
    <PopoverPanel
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
    </PopoverPanel>
  )
}

export function SidebarInboxSection({
  appLaunchedAtMs,
  terminalRunningConversationIds,
  chats,
  selectedConversationId,
  onAction,
  onDismissChat,
  onSelectChat,
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
  const scrollRegionRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

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

  useHowcodeKeybindingCommand('sidebar.find', (event) => {
    event.preventDefault()
    searchInputRef.current?.focus()
    searchInputRef.current?.select()
  })

  const visibleChats = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    return chats.filter((chat) => {
      if (showUnreadOnly && !chat.unread) return false
      if (normalizedQuery && !matchesInboxSearch(chat, normalizedQuery)) return false
      return matchesInboxFilter(chat, filterMode, terminalRunningConversationIds, appLaunchedAtMs)
    })
  }, [
    appLaunchedAtMs,
    filterMode,
    searchQuery,
    showUnreadOnly,
    terminalRunningConversationIds,
    chats,
  ])

  const filterIcon = getInboxFilterIcon(filterMode)
  const filterLabel = getInboxFilterLabel(filterMode)

  useEffect(() => {
    if (!selectedConversationId) return
    if (!visibleChats.some((chat) => chat.conversationId === selectedConversationId)) return
    const selectedRow = scrollRegionRef.current?.querySelector<HTMLElement>(
      '[data-inbox-thread-selected="true"]',
    )
    selectedRow?.scrollIntoView({ block: 'nearest' })
  }, [selectedConversationId, visibleChats])

  return (
    <section className="sidebar-section">
      <div className="sidebar-toolbar">
        <div
          className="sidebar-search-field"
          data-active={searchQuery.trim().length > 0 ? 'true' : 'false'}
        >
          <Search size={14} className="sidebar-search-icon" />
          <input
            ref={searchInputRef}
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

      {visibleChats.length > 0 ? (
        <div ref={scrollRegionRef} className="sidebar-scroll-region">
          <div className="sidebar-list">
            {visibleChats.map((chat) => (
              <div
                key={chat.conversationId}
                data-inbox-chat-selected={
                  selectedConversationId === chat.conversationId ? 'true' : 'false'
                }
              >
                <InboxChatRow
                  age={chat.age}
                  preview={chat.preview}
                  directoryName={chat.directoryName}
                  running={chat.running}
                  terminalRunning={terminalRunningConversationIds.has(chat.conversationId)}
                  selected={selectedConversationId === chat.conversationId}
                  title={chat.title}
                  unread={chat.unread}
                  onDismiss={() => onDismissChat(chat)}
                  onSelect={() => onSelectChat(chat)}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyStateCard
          className={cn(
            'grid gap-1.5 px-3 py-4 text-center',
            appTypeControlClass,
            appToneMutedClass,
          )}
        >
          <div className={cn(appTypeGroupTextClass, appToneTextClass)}>No inbox items</div>
          <div>{getEmptyInboxMessage(showUnreadOnly, filterMode)}</div>
        </EmptyStateCard>
      )}
    </section>
  )
}
