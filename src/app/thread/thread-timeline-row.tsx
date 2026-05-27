import { ThreadMessage } from '../common/thread-message'
import { appToneSubtleClass, appTypeGroupTextClass } from '../ui/classes'
import { cn } from '../utils/cn'
import { getCollapsedTurnPreview } from './thread-timeline-previews'
import {
  FoldedTimelineRow,
  RowLeadToggleSurface,
  TimelineRowShell,
} from './thread-timeline-row-chrome'
import { isTurnRowCollapsible, type TimelineRow, type TimelineTurnItem } from './timeline-row'
import { ToolCallsCard } from './tool-calls-card'

type ThreadTimelineRowProps = {
  row: TimelineRow
  collapsed: boolean
  activeFindMessageId: string | null
  findQuery: string
  streamingAssistantMessageId: string | null
  streamingToolGroupId: string | null
  expandedToolGroupIds: Record<string, boolean>
  onToggleRowCollapse: (rowId: string) => void
  onToggleToolCallExpansion: () => void
  onToggleToolGroupExpansion: (groupId: string) => void
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
  collapsed,
  onToggleRowCollapse,
  renderTurnItem,
  row,
  streamingAssistantMessageId,
  activeFindMessageId,
  findQuery,
}: {
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
  if (isCollapsed) {
    const preview = getCollapsedTurnPreview(row)
    return (
      <TimelineRowShell
        expanded={false}
        ariaLabel="Expand turn"
        onToggle={onToggleTurnCollapse}
        toggleClassName="mt-2"
      >
        <FoldedTimelineRow
          label={preview.label}
          secondary={preview.secondary}
          italicLabel={preview.italicLabel}
          mutedLabel={preview.mutedLabel ?? preview.italicLabel}
          tone={row.userMessage?.role === 'user' ? 'user' : 'default'}
          onToggle={() => onToggleTurnCollapse?.()}
        />
      </TimelineRowShell>
    )
  }
  return (
    <TimelineRowShell
      expanded
      ariaLabel="Collapse turn"
      onToggle={onToggleTurnCollapse}
      toggleClassName="mt-2"
    >
      <div className="grid min-w-0 gap-2">
        {row.userMessage ? (
          <RowLeadToggleSurface onToggle={onToggleTurnCollapse}>
            <div data-message-id={row.userMessage.id}>
              <ThreadMessage
                message={row.userMessage}
                findActive={row.userMessage.id === activeFindMessageId}
                findQuery={findQuery}
              />
            </div>
          </RowLeadToggleSurface>
        ) : null}
        {row.items.map(renderTurnItem)}
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
            <ThreadMessage message={row.message} />
          </div>
        </RowLeadToggleSurface>
      </div>
    </TimelineRowShell>
  )
}

export function ThreadTimelineRow({
  row,
  collapsed,
  streamingAssistantMessageId,
  activeFindMessageId,
  findQuery,
  streamingToolGroupId,
  expandedToolGroupIds,
  onToggleRowCollapse,
  onToggleToolCallExpansion,
  onToggleToolGroupExpansion,
  onJumpToEarlierMessages,
}: ThreadTimelineRowProps) {
  const renderTurnItem = (item: TimelineTurnItem) => {
    if (item.kind === 'tool-group') {
      return (
        <ToolCallsCard
          key={item.id}
          id={item.id}
          messages={item.messages}
          expanded={item.id === streamingToolGroupId || Boolean(expandedToolGroupIds[item.id])}
          forceExpanded={item.id === streamingToolGroupId}
          onToggleGroupExpanded={() => onToggleToolGroupExpansion(item.id)}
          onToggleToolCallExpanded={onToggleToolCallExpansion}
        />
      )
    }

    return (
      <div key={item.id} data-message-id={item.message.id}>
        <ThreadMessage
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
