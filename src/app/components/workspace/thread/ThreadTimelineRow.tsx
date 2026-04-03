import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { getAssistantPreview, getToolCallPreview } from "../../../utils/thread-previews";
import { ThreadMessage } from "../../common/ThreadMessage";
import { ThreadInlineDiffCard } from "./ThreadInlineDiffCard";
import { ToolCallsCard } from "./ToolCallsCard";
import { chatRowShellClass } from "./thread-layout";
import type { TimelineRow, TimelineTurnItem } from "./timeline-row";

function getTurnPreview(row: Extract<TimelineRow, { kind: "turn" }>) {
  const leadingAssistantMessage = row.items.find(
    (item) => item.kind === "message" && item.message.role === "assistant",
  ) as Extract<TimelineTurnItem, { kind: "message" }> | undefined;
  const leadingToolGroup = row.items.find((item) => item.kind === "tool-group") as
    | Extract<TimelineTurnItem, { kind: "tool-group" }>
    | undefined;
  const userPreview =
    row.userMessage?.content[0] ??
    (leadingAssistantMessage?.message.role === "assistant"
      ? getAssistantPreview(leadingAssistantMessage.message)
      : null) ??
    (leadingToolGroup ? getToolCallPreview(leadingToolGroup.messages[0]) : null) ??
    "Continued turn";
  const assistantMessage = row.items.find(
    (item) => item.kind === "message" && item.message.role === "assistant",
  ) as Extract<TimelineTurnItem, { kind: "message" }> | undefined;

  return {
    userPreview,
    assistantPreview:
      row.userMessage && assistantMessage?.message.role === "assistant"
        ? getAssistantPreview(assistantMessage.message)
        : null,
  };
}

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
      <div className="shrink-0 truncate text-[12.5px] leading-none font-medium text-[color:var(--text)]/92">
        {label}
      </div>
      {secondary ? (
        <>
          <span className="shrink-0 text-[11px] leading-none text-[color:var(--muted-2)]/80">
            —
          </span>
          <div className="min-w-0 flex-1 truncate text-[11.5px] leading-none text-[color:var(--muted-2)]/90">
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
  children,
}: {
  expanded?: boolean;
  ariaLabel?: string;
  onToggle?: () => void;
  children: ReactNode;
}) {
  return (
    <div className={chatRowShellClass}>
      {onToggle ? (
        <button
          type="button"
          className="mt-2 inline-flex h-5 w-5 items-center justify-center rounded-md text-[color:var(--muted)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]"
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
    const preview = getTurnPreview(row);

    if (isCollapsed) {
      return (
        <TimelineRowShell expanded={false} ariaLabel="Expand turn" onToggle={onToggleTurnCollapse}>
          <FoldedTimelineRow
            label={preview.userPreview}
            secondary={preview.assistantPreview}
            onToggle={onToggleTurnCollapse ?? (() => undefined)}
          />
        </TimelineRowShell>
      );
    }

    return (
      <TimelineRowShell expanded ariaLabel="Collapse turn" onToggle={onToggleTurnCollapse}>
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

    if (collapsed) {
      return (
        <TimelineRowShell
          expanded={false}
          ariaLabel={`Expand ${summaryLabel.toLowerCase()}`}
          onToggle={() => onToggleRowCollapse(row.id)}
        >
          <FoldedTimelineRow label={summaryLabel} onToggle={() => onToggleRowCollapse(row.id)} />
        </TimelineRowShell>
      );
    }

    return (
      <TimelineRowShell
        expanded
        ariaLabel={`Collapse ${summaryLabel.toLowerCase()}`}
        onToggle={() => onToggleRowCollapse(row.id)}
      >
        <div className="min-w-0">
          <ThreadMessage message={row.message} />
        </div>
      </TimelineRowShell>
    );
  }

  return <TimelineRowShell>{renderTurnItem(row)}</TimelineRowShell>;
}
