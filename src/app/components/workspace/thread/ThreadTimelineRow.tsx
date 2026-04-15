import { ThreadMessage } from "../../common/ThreadMessage";
import {
  FoldedTimelineRow,
  RowLeadToggleSurface,
  TimelineRowShell,
} from "./ThreadTimelineRowChrome";
import { ToolCallsCard } from "./ToolCallsCard";
import { getCollapsedTurnPreview } from "./thread-timeline-previews";
import { type TimelineRow, type TimelineTurnItem, isTurnRowCollapsible } from "./timeline-row";

type ThreadTimelineRowProps = {
  row: TimelineRow;
  collapsed: boolean;
  streamingAssistantMessageId: string | null;
  streamingToolGroupId: string | null;
  expandedToolGroupIds: Record<string, boolean>;
  onToggleRowCollapse: (rowId: string) => void;
  onToggleToolCallExpansion: () => void;
  onToggleToolGroupExpansion: (groupId: string) => void;
  onJumpToEarlierMessages: () => void;
};

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
    if (item.kind === "tool-group") {
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
      );
    }

    return (
      <ThreadMessage
        key={item.id}
        message={item.message}
        autoExpandThinking={item.message.id === streamingAssistantMessageId}
        onToggleExpanded={onToggleToolCallExpansion}
      />
    );
  };

  if (row.kind === "history-divider") {
    return (
      <TimelineRowShell>
        <button
          type="button"
          className="group flex w-full items-center justify-center py-1 text-[13px] text-[color:var(--muted-2)]"
          onClick={onJumpToEarlierMessages}
        >
          <span className="rounded-[12px] px-3 py-1 transition-colors group-hover:bg-[rgba(255,255,255,0.03)] group-focus-visible:bg-[rgba(255,255,255,0.03)]">
            {row.hiddenCount} earlier messages
          </span>
        </button>
      </TimelineRowShell>
    );
  }

  if (row.kind === "turn") {
    const canCollapseTurn = isTurnRowCollapsible(row);
    const isStreamingTurn = row.items.some(
      (item) => item.kind === "message" && item.message.id === streamingAssistantMessageId,
    );
    const isCollapsed = collapsed && !isStreamingTurn;
    const onToggleTurnCollapse =
      !canCollapseTurn || isStreamingTurn ? undefined : () => onToggleRowCollapse(row.id);
    const chevronOffsetClass = "mt-2";
    if (isCollapsed) {
      const preview = getCollapsedTurnPreview(row);

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
      );
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
          {row.items.map((item, index) => {
            if (row.userMessage || index > 0) {
              return renderTurnItem(item);
            }

            if (item.kind === "tool-group") {
              return renderTurnItem(item);
            }

            if (item.message.role === "assistant") {
              return (
                <ThreadMessage
                  key={`lead:${item.id}`}
                  message={item.message}
                  autoExpandThinking={item.message.id === streamingAssistantMessageId}
                  onToggleExpanded={onToggleTurnCollapse}
                  primaryToggleAction={onToggleTurnCollapse}
                />
              );
            }

            return (
              <RowLeadToggleSurface key={`lead:${item.id}`} onToggle={onToggleTurnCollapse}>
                {renderTurnItem(item)}
              </RowLeadToggleSurface>
            );
          })}
        </div>
      </TimelineRowShell>
    );
  }

  if (row.kind === "summary") {
    const summaryLabel =
      row.message.role === "branchSummary" ? "Branch summary" : "Compaction summary";
    const summarySecondary =
      row.message.role === "compactionSummary"
        ? "Very long — expand only if you really need the full dump."
        : null;
    const showCompactionDivider = row.message.role === "compactionSummary";
    const chevronOffsetClass = showCompactionDivider ? "mt-[22px]" : "mt-2";

    if (collapsed) {
      return (
        <TimelineRowShell
          expanded={false}
          ariaLabel={`Expand ${summaryLabel.toLowerCase()}`}
          onToggle={() => onToggleRowCollapse(row.id)}
          toggleClassName={chevronOffsetClass}
        >
          <div className="grid min-w-0 gap-3">
            {showCompactionDivider ? (
              <div className="h-px w-full bg-[rgba(161,173,221,0.14)]" />
            ) : null}
            <FoldedTimelineRow
              label={summaryLabel}
              secondary={summarySecondary}
              singleLine
              onToggle={() => onToggleRowCollapse(row.id)}
            />
          </div>
        </TimelineRowShell>
      );
    }

    return (
      <TimelineRowShell
        expanded
        ariaLabel={`Collapse ${summaryLabel.toLowerCase()}`}
        onToggle={() => onToggleRowCollapse(row.id)}
        toggleClassName={chevronOffsetClass}
      >
        <div className="grid min-w-0 gap-3">
          {showCompactionDivider ? (
            <div className="h-px w-full bg-[rgba(161,173,221,0.14)]" />
          ) : null}
          <RowLeadToggleSurface onToggle={() => onToggleRowCollapse(row.id)}>
            <ThreadMessage message={row.message} />
          </RowLeadToggleSurface>
        </div>
      </TimelineRowShell>
    );
  }

  return <TimelineRowShell>{renderTurnItem(row)}</TimelineRowShell>;
}
