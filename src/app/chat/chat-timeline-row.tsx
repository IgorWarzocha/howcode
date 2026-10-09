import {
  appToneSubtleClass,
  appTypeGroupTextClass,
} from '@howaboua/howcode-sdk/ui/typography-scale'
import { cn } from '@howaboua/howcode-sdk/utils/cn'
import { ChatMessage } from '../common/chat-message'
import { TurnAttachments } from '../component-system/turn-attachments'
import { getCollapsedTurnPreview } from './chat-timeline-previews'
import {
  FoldedTimelineRow,
  RowLeadToggleSurface,
  TimelineRowShell,
} from './chat-timeline-row-chrome'
import { isTurnRowCollapsible, type TimelineRow, type TimelineTurnItem } from './timeline-row'
import { ToolCallsCard } from './tool-calls-card'

type ChatTimelineRowProps = {
  conversationId: string | null | undefined
  row: TimelineRow
  collapsed: boolean
  activeFindMessageId: string | null
  findQuery: string
  streamingAssistantMessageId: string | null
  streamingToolWorkspaceId: string | null
  expandedToolWorkspaceIds: Record<string, boolean>
  onToggleRowCollapse: (rowId: string) => void
  onToggleToolCallExpansion: () => void
  onToggleToolGroupExpansion: (workspaceId: string) => void
  onJumpToEarlierMessages: () => void
}

type RenderTurnItem = (item: TimelineTurnItem) => React.ReactNode

function HistoryDividerRow({
  hiddenCount,
  onJumpToEarlierMessages,
}: {
  hiddenCount: number
  onJumpToEarlierMessages: () => void
}) {
  return (
    <TimelineRowShell>
      <button
        type="button"
        className={cn(
          'group flex w-full items-center justify-center py-1',
          appTypeGroupTextClass,
          appToneSubtleClass,
        )}
        onClick={onJumpToEarlierMessages}
      >
        <span className="rounded-[12px] px-3 py-1 transition-colors group-hover:bg-[color:var(--surface-hover)] group-focus-visible:bg-[color:var(--surface-hover)]">
          {hiddenCount} earlier messages
        </span>
      </button>
    </TimelineRowShell>
  )
}

function TurnRow({
  conversationId,
  collapsed,
  onToggleRowCollapse,
  renderTurnItem,
  row,
  streamingAssistantMessageId,
  activeFindMessageId,
  findQuery,
}: {
  conversationId: string | null | undefined
  collapsed: boolean
  onToggleRowCollapse: (rowId: string) => void
  renderTurnItem: RenderTurnItem
  row: Extract<TimelineRow, { kind: 'turn' }>
  streamingAssistantMessageId: string | null
  activeFindMessageId: string | null
  findQuery: string
}) {
  const canCollapseTurn = isTurnRowCollapsible(row)
  const isStreamingTurn = row.items.some(
    (item) => item.kind === 'message' && item.message.id === streamingAssistantMessageId,
  )
  const isCollapsed = collapsed && !isStreamingTurn
  const onToggleTurnCollapse =
    !canCollapseTurn || isStreamingTurn ? undefined : () => onToggleRowCollapse(row.id)
  const preview = isCollapsed ? getCollapsedTurnPreview(row) : null
  return (
    <TimelineRowShell
      expanded={!isCollapsed}
      ariaLabel={isCollapsed ? 'Expand turn' : 'Collapse turn'}
      onToggle={onToggleTurnCollapse}
      toggleClassName="mt-2"
    >
      <div className="grid min-w-0 gap-2">
        {preview ? (
          <FoldedTimelineRow
            label={preview.label}
            secondary={preview.secondary}
            italicLabel={preview.italicLabel}
            mutedLabel={preview.mutedLabel ?? preview.italicLabel}
            tone={row.userMessage?.role === 'user' ? 'user' : 'default'}
            onToggle={() => onToggleTurnCollapse?.()}
          />
        ) : (
          <div className="grid min-w-0 gap-2">
            {row.userMessage ? (
              <RowLeadToggleSurface onToggle={onToggleTurnCollapse}>
                <div data-message-id={row.userMessage.id}>
                  <ChatMessage
                    message={row.userMessage}
                    findActive={row.userMessage.id === activeFindMessageId}
                    findQuery={findQuery}
                  />
                </div>
              </RowLeadToggleSurface>
            ) : null}
            {row.items.map(renderTurnItem)}
          </div>
        )}
        {/* Hide only the inline anchors. Portaled docked surfaces keep this stable lifetime. */}
        <div hidden={isCollapsed} className="empty:hidden">
          {conversationId && row.userMessage ? (
            <TurnAttachments conversationId={conversationId} turnId={row.userMessage.id} />
          ) : null}
        </div>
      </div>
    </TimelineRowShell>
  )
}

function SummaryRow({
  collapsed,
  onToggleRowCollapse,
  row,
}: {
  collapsed: boolean
  onToggleRowCollapse: (rowId: string) => void
  row: Extract<TimelineRow, { kind: 'summary' }>
}) {
  const summaryLabel =
    row.message.role === 'branchSummary' ? 'Branch summary' : 'Compaction summary'
  const summarySecondary =
    row.message.role === 'compactionSummary'
      ? 'Very long — expand only if you really need the full dump.'
      : null
  const onToggle = () => onToggleRowCollapse(row.id)
  if (collapsed)
    return (
      <TimelineRowShell
        expanded={false}
        ariaLabel={`Expand ${summaryLabel.toLowerCase()}`}
        onToggle={onToggle}
        toggleClassName="mt-2"
      >
        <div className="grid min-w-0 gap-2">
          <FoldedTimelineRow
            label={summaryLabel}
            secondary={summarySecondary}
            mutedLabel
            singleLine
            onToggle={onToggle}
          />
        </div>
      </TimelineRowShell>
    )
  return (
    <TimelineRowShell
      expanded
      ariaLabel={`Collapse ${summaryLabel.toLowerCase()}`}
      onToggle={onToggle}
      toggleClassName="mt-2"
    >
      <div className="grid min-w-0 gap-2">
        <RowLeadToggleSurface onToggle={onToggle}>
          <div data-message-id={row.message.id}>
            <ChatMessage message={row.message} />
          </div>
        </RowLeadToggleSurface>
      </div>
    </TimelineRowShell>
  )
}

export function ChatTimelineRow({
  conversationId,
  row,
  collapsed,
  streamingAssistantMessageId,
  activeFindMessageId,
  findQuery,
  streamingToolWorkspaceId,
  expandedToolWorkspaceIds,
  onToggleRowCollapse,
  onToggleToolCallExpansion,
  onToggleToolGroupExpansion,
  onJumpToEarlierMessages,
}: ChatTimelineRowProps) {
  const renderTurnItem = (item: TimelineTurnItem) => {
    if (item.kind === 'tool-group') {
      return (
        <ToolCallsCard
          key={item.id}
          id={item.id}
          messages={item.messages}
          expanded={
            item.id === streamingToolWorkspaceId || Boolean(expandedToolWorkspaceIds[item.id])
          }
          forceExpanded={item.id === streamingToolWorkspaceId}
          onToggleGroupExpanded={() => onToggleToolGroupExpansion(item.id)}
          onToggleToolCallExpanded={onToggleToolCallExpansion}
        />
      )
    }

    return (
      <div key={item.id} data-message-id={item.message.id}>
        <ChatMessage
          message={item.message}
          findActive={item.message.id === activeFindMessageId}
          findQuery={findQuery}
          autoExpandThinking={item.message.id === streamingAssistantMessageId}
          onToggleExpanded={onToggleToolCallExpansion}
        />
      </div>
    )
  }

  if (row.kind === 'history-divider') {
    return (
      <HistoryDividerRow
        hiddenCount={row.hiddenCount}
        onJumpToEarlierMessages={onJumpToEarlierMessages}
      />
    )
  }
  if (row.kind === 'turn') {
    return (
      <TurnRow
        conversationId={conversationId}
        collapsed={collapsed}
        onToggleRowCollapse={onToggleRowCollapse}
        renderTurnItem={renderTurnItem}
        row={row}
        streamingAssistantMessageId={streamingAssistantMessageId}
        activeFindMessageId={activeFindMessageId}
        findQuery={findQuery}
      />
    )
  }
  if (row.kind === 'summary') {
    return <SummaryRow collapsed={collapsed} onToggleRowCollapse={onToggleRowCollapse} row={row} />
  }

  return <TimelineRowShell>{renderTurnItem(row)}</TimelineRowShell>
}
