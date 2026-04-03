import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { ThreadMessage } from "../../common/ThreadMessage";
import { ThreadInlineDiffCard } from "./ThreadInlineDiffCard";
import { ToolCallsCard } from "./ToolCallsCard";
import { chatRowShellClass } from "./thread-layout";
import type { TimelineRow, TimelineTurnItem } from "./timeline-row";

function FoldedTimelineRow({
  label,
  secondary,
  onToggle,
}: {
  label: string;
  secondary?: string | null;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="flex min-w-0 items-center gap-1.5 rounded-xl border border-[rgba(169,178,215,0.08)] bg-[rgba(17,19,27,0.28)] px-3 py-2 text-left transition-colors hover:bg-[rgba(255,255,255,0.03)]"
      onClick={onToggle}
    >
      <div className="min-w-0 flex-1 truncate text-[12.5px] leading-[1.2] font-medium text-[color:var(--text)]/92">
        {label}
      </div>
      {secondary ? (
        <>
          <span className="shrink-0 text-[11px] leading-[1.2] text-[color:var(--muted-2)]/80">
            —
          </span>
          <div className="min-w-0 flex-1 truncate text-[11.5px] leading-[1.2] text-[color:var(--muted-2)]/90">
            {secondary}
          </div>
        </>
      ) : null}
    </button>
  );
}

function TimelineRowShell({
  expanded,
  ariaLabel,
  onToggle,
  toggleClassName,
  children,
}: {
  expanded?: boolean;
  ariaLabel?: string;
  onToggle?: () => void;
  toggleClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className={chatRowShellClass}>
      {onToggle ? (
        <button
          type="button"
          className={`${toggleClassName ?? "mt-1"} inline-flex h-5 w-5 items-center justify-center rounded-md text-[color:var(--muted)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]`}
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={ariaLabel}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      ) : (
        <div />
      )}
      <div className="min-w-0">{children}</div>
      <div />
    </div>
  );
}

type ThreadTimelineRowProps = {
  row: TimelineRow;
  collapsed: boolean;
  streamingAssistantMessageId: string | null;
  expandedDiffTrees: Record<number, boolean>;
  onToggleRowCollapse: (rowId: string) => void;
  onToggleToolCallExpansion: () => void;
  onToggleDiffTree: (checkpointTurnCount: number) => void;
  onOpenTurnDiff: (checkpointTurnCount: number, filePath?: string) => void;
  onJumpToEarlierMessages: () => void;
};

export function ThreadTimelineRow({
  row,
  collapsed,
  streamingAssistantMessageId,
  expandedDiffTrees,
  onToggleRowCollapse,
  onToggleToolCallExpansion,
  onToggleDiffTree,
  onOpenTurnDiff,
  onJumpToEarlierMessages,
}: ThreadTimelineRowProps) {
  const renderTurnItem = (item: TimelineTurnItem) => {
    if (item.kind === "tool-group") {
      return (
        <ToolCallsCard
          key={item.id}
          messages={item.messages}
          onToggleExpanded={onToggleToolCallExpansion}
        />
      );
    }

    const { message, turnSummary } = item;
    const allDirectoriesExpanded =
      turnSummary && expandedDiffTrees[turnSummary.checkpointTurnCount] !== false;

    return (
      <Fragment key={item.id}>
        <ThreadMessage
          message={message}
          autoExpandThinking={message.id === streamingAssistantMessageId}
          onToggleExpanded={onToggleToolCallExpansion}
        />
        {turnSummary && turnSummary.files.length > 0 ? (
          <ThreadInlineDiffCard
            turnSummary={turnSummary}
            allDirectoriesExpanded={Boolean(allDirectoriesExpanded)}
            onToggleExpanded={() => onToggleDiffTree(turnSummary.checkpointTurnCount)}
            onOpenTurnDiff={onOpenTurnDiff}
          />
        ) : null}
      </Fragment>
    );
  };

  const renderCollapsedTurnLead = (row: Extract<TimelineRow, { kind: "turn" }>) => {
    if (row.userMessage) {
      return <ThreadMessage message={row.userMessage} />;
    }

    const firstItem = row.items[0];
    if (firstItem) {
      if (firstItem.kind === "tool-group") {
        const firstToolCall = firstItem.messages[0];
        return firstToolCall ? <ToolCallsCard messages={[firstToolCall]} disableExpansion /> : null;
      }

      return <ThreadMessage message={firstItem.message} firstCardOnly disableInnerExpansion />;
    }

    return (
      <FoldedTimelineRow label="Continued turn" onToggle={() => onToggleRowCollapse(row.id)} />
    );
  };

  if (row.kind === "history-divider") {
    return (
      <TimelineRowShell>
        <button
          type="button"
          className="flex w-full items-center gap-4 py-1 text-[13px] text-[color:var(--muted-2)]"
          onClick={onJumpToEarlierMessages}
        >
          <div className="h-px flex-1 bg-[rgba(161,173,221,0.12)]" />
          <span>{row.hiddenCount} earlier messages</span>
          <div className="h-px flex-1 bg-[rgba(161,173,221,0.12)]" />
        </button>
      </TimelineRowShell>
    );
  }

  if (row.kind === "turn") {
    const isStreamingTurn = row.items.some(
      (item) => item.kind === "message" && item.message.id === streamingAssistantMessageId,
    );
    const isCollapsed = collapsed && !isStreamingTurn;
    const onToggleTurnCollapse = isStreamingTurn ? undefined : () => onToggleRowCollapse(row.id);
    const chevronOffsetClass = row.userMessage ? "mt-2" : "mt-1";

    if (isCollapsed) {
      return (
        <TimelineRowShell
          expanded={false}
          ariaLabel="Expand turn"
          onToggle={onToggleTurnCollapse}
          toggleClassName={chevronOffsetClass}
        >
          <div className="grid min-w-0 gap-3">{renderCollapsedTurnLead(row)}</div>
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
          {row.userMessage ? <ThreadMessage message={row.userMessage} /> : null}
          {row.items.map(renderTurnItem)}
        </div>
      </TimelineRowShell>
    );
  }

  if (row.kind === "summary") {
    const summaryLabel =
      row.message.role === "branchSummary" ? "Branch summary" : "Compaction summary";
    const showCompactionDivider = row.message.role === "compactionSummary";
    const chevronOffsetClass = showCompactionDivider ? "mt-4" : "mt-1";
    const summaryContent = (
      <>
        {showCompactionDivider ? <div className="h-px w-full bg-[rgba(161,173,221,0.14)]" /> : null}
        <div className="min-w-0">
          {collapsed ? (
            <FoldedTimelineRow label={summaryLabel} onToggle={() => onToggleRowCollapse(row.id)} />
          ) : (
            <ThreadMessage message={row.message} />
          )}
        </div>
      </>
    );

    if (collapsed) {
      return (
        <TimelineRowShell
          expanded={false}
          ariaLabel={`Expand ${summaryLabel.toLowerCase()}`}
          onToggle={() => onToggleRowCollapse(row.id)}
          toggleClassName={chevronOffsetClass}
        >
          <div className="grid min-w-0 gap-3">{summaryContent}</div>
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
        <div className="grid min-w-0 gap-3">{summaryContent}</div>
      </TimelineRowShell>
    );
  }

  return <TimelineRowShell>{renderTurnItem(row)}</TimelineRowShell>;
}
