import { ThreadMessage } from '../../common/thread-message'
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
        className="group flex w-full items-center justify-center py-1 text-[13px] text-[color:var(--muted-2)]"
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
}: {
  collapsed: boolean
  onToggleRowCollapse: (rowId: string) => void
  renderTurnItem: RenderTurnItem
  row: Extract<TimelineRow, { kind: 'turn' }>
  streamingAssistantMessageId: string | null
}) {
  const canCollapseTurn = isTurnRowCollapsible(row)
  const isStreamingTurn = row.items.some(
    (item) => item.kind === 'message' && item.message.id === streamingAssistantMessageId,
  )
  const isCollapsed = collapsed && !isStreamingTurn
  const onToggleTurnCollapse =
    !canCollapseTurn || isStreamingTurn ? undefined : () => onToggleRowCollapse(row.id)
  const chevronOffsetClass = 'mt-2'
  if (isCollapsed) {
    const preview = getCollapsedTurnPreview(row)
    return (
      <TimelineRowShell
        expanded={false}
        ariaLabel="Expand turn"
        onToggle={onToggleTurnCollapse}
        toggleClassName={chevronOffsetClass}
      >
        <FoldedTimelineRow
          label={preview.label}
          secondary={preview.secondary}
          italicLabel={preview.italicLabel}
          mutedLabel={preview.italicLabel}
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
      toggleClassName={chevronOffsetClass}
    >
      <div className="grid min-w-0 gap-3">
        {row.userMessage ? (
          <RowLeadToggleSurface onToggle={onToggleTurnCollapse}>
            <ThreadMessage message={row.userMessage} />
          </RowLeadToggleSurface>
        ) : null}
        {row.items.map((item, index) =>
          renderVisibleTurnItem({
            item,
            index,
            onToggleTurnCollapse,
            renderTurnItem,
            row,
            streamingAssistantMessageId,
          }),
        )}
      </div>
    </TimelineRowShell>
  )
}

function renderVisibleTurnItem(input: {
  item: TimelineTurnItem
  index: number
  onToggleTurnCollapse?: (() => void) | undefined
  renderTurnItem: RenderTurnItem
  row: Extract<TimelineRow, { kind: 'turn' }>
  streamingAssistantMessageId: string | null
}) {
  const { item, index, onToggleTurnCollapse, renderTurnItem, row, streamingAssistantMessageId } =
    input
  if (row.userMessage || index > 0 || item.kind === 'tool-group') return renderTurnItem(item)
  if (item.message.role === 'assistant')
    return (
      <ThreadMessage
        key={`lead:${item.id}`}
        message={item.message}
        autoExpandThinking={item.message.id === streamingAssistantMessageId}
        onToggleExpanded={onToggleTurnCollapse}
        primaryToggleAction={onToggleTurnCollapse}
      />
    )
  return (
    <RowLeadToggleSurface key={`lead:${item.id}`} onToggle={onToggleTurnCollapse}>
      {renderTurnItem(item)}
    </RowLeadToggleSurface>
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
  const showCompactionDivider = row.message.role === 'compactionSummary'
  const chevronOffsetClass = showCompactionDivider ? 'mt-[22px]' : 'mt-2'
  const onToggle = () => onToggleRowCollapse(row.id)
  if (collapsed)
    return (
      <TimelineRowShell
        expanded={false}
        ariaLabel={`Expand ${summaryLabel.toLowerCase()}`}
        onToggle={onToggle}
        toggleClassName={chevronOffsetClass}
      >
        <div className="grid min-w-0 gap-3">
          {showCompactionDivider ? (
            <div className="h-px w-full bg-[color:var(--border-strong)]" />
          ) : null}
          <FoldedTimelineRow
            label={summaryLabel}
            secondary={summarySecondary}
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
      toggleClassName={chevronOffsetClass}
    >
      <div className="grid min-w-0 gap-3">
        {showCompactionDivider ? (
          <div className="h-px w-full bg-[color:var(--border-strong)]" />
        ) : null}
        <RowLeadToggleSurface onToggle={onToggle}>
          <ThreadMessage message={row.message} />
        </RowLeadToggleSurface>
      </div>
    </TimelineRowShell>
  )
}

export function ThreadTimelineRow({
  row,
  collapsed,
  streamingAssistantMessageId,
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
      <ThreadMessage
        key={item.id}
        message={item.message}
        autoExpandThinking={item.message.id === streamingAssistantMessageId}
        onToggleExpanded={onToggleToolCallExpansion}
      />
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
      />
    )
  }
  if (row.kind === 'summary') {
    return <SummaryRow collapsed={collapsed} onToggleRowCollapse={onToggleRowCollapse} row={row} />
  }

  return <TimelineRowShell>{renderTurnItem(row)}</TimelineRowShell>
}
