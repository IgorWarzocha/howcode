import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import type { Message } from "../../../types";
import { getAssistantPreview } from "../../../utils/thread-previews";
import { ThreadMessage } from "../../common/ThreadMessage";
import { ThreadInlineDiffCard } from "./ThreadInlineDiffCard";
import { ToolCallsCard } from "./ToolCallsCard";
import { chatRowShellClass } from "./thread-layout";
import { type TimelineRow, type TimelineTurnItem, isTurnRowCollapsible } from "./timeline-row";

const clampOneLineClass =
  "overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:1]";
const clampTwoLinesClass =
  "overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]";
const clampThreeLinesClass =
  "overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]";

function getMessagePreview(message: Message) {
  switch (message.role) {
    case "user":
    case "custom":
    case "branchSummary":
    case "compactionSummary":
      return message.content.join(" ").trim();
    case "assistant":
      return getAssistantPreview(message) ?? message.content.join(" ").trim();
    case "toolResult":
      return [message.toolName, message.content.join(" ")].filter(Boolean).join(" — ");
    case "bashExecution":
      return `$ ${message.command}`.trim();
    default:
      return "";
  }
}

function getToolGroupPreview(item: Extract<TimelineTurnItem, { kind: "tool-group" }>) {
  const firstMessage = item.messages[0];
  if (!firstMessage) {
    return "Tool call";
  }

  if (firstMessage.role === "toolResult") {
    return [firstMessage.toolName, firstMessage.content.join(" ")].filter(Boolean).join(" — ");
  }

  return `$ ${firstMessage.command}`.trim();
}

function getCollapsedTurnPreview(row: Extract<TimelineRow, { kind: "turn" }>) {
  if (row.userMessage) {
    const primary = getMessagePreview(row.userMessage);
    const firstAssistantMessage = row.items.find(
      (item) => item.kind === "message" && item.message.role === "assistant",
    ) as Extract<TimelineTurnItem, { kind: "message" }> | undefined;

    return {
      label: primary,
      secondary: firstAssistantMessage ? getMessagePreview(firstAssistantMessage.message) : null,
      italicLabel: false,
    };
  }

  const firstItem = row.items[0];
  if (!firstItem) {
    return { label: "Continued turn", secondary: null, italicLabel: false };
  }

  if (firstItem.kind === "tool-group") {
    return { label: getToolGroupPreview(firstItem), secondary: null, italicLabel: false };
  }

  return {
    label: getMessagePreview(firstItem.message),
    secondary: null,
    italicLabel: firstItem.message.role === "assistant",
  };
}

function FoldedTimelineRow({
  label,
  secondary,
  singleLine = false,
  italicLabel = false,
  mutedLabel = false,
  onToggle,
}: {
  label: string;
  secondary?: string | null;
  singleLine?: boolean;
  italicLabel?: boolean;
  mutedLabel?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="grid w-full min-w-0 gap-1 rounded-xl border border-[rgba(169,178,215,0.08)] bg-[rgba(17,19,27,0.28)] px-3 py-2.5 text-left transition-colors hover:bg-[rgba(255,255,255,0.03)]"
      onClick={onToggle}
    >
      <div
        className={`min-w-0 text-[13px] font-medium leading-[1.4] ${mutedLabel ? "text-[color:var(--muted-2)]/90" : "text-[color:var(--text)]/92"} ${italicLabel ? "italic" : ""} ${singleLine || secondary ? clampOneLineClass : clampThreeLinesClass}`}
      >
        {label}
      </div>
      {secondary ? (
        <div
          className={`min-w-0 text-[12px] leading-[1.4] text-[color:var(--muted-2)]/90 ${clampTwoLinesClass}`}
        >
          {secondary}
        </div>
      ) : null}
    </button>
  );
}

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest('button, a, input, textarea, select, summary, [data-no-row-toggle="true"]'),
  );
}

function RowLeadToggleSurface({
  onToggle,
  children,
}: {
  onToggle?: () => void;
  children: ReactNode;
}) {
  if (!onToggle) {
    return <>{children}</>;
  }

  return (
    <div
      className="block w-full min-w-0 cursor-pointer text-left"
      onPointerUp={(event: PointerEvent<HTMLDivElement>) => {
        if (isInteractiveTarget(event.target)) {
          return;
        }

        onToggle();
      }}
    >
      {children}
    </div>
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
  streamingToolGroupId: string | null;
  expandedToolGroupIds: Record<string, boolean>;
  expandedDiffTrees: Record<number, boolean>;
  onToggleRowCollapse: (rowId: string) => void;
  onToggleToolCallExpansion: () => void;
  onToggleToolGroupExpansion: (groupId: string) => void;
  onToggleDiffTree: (checkpointTurnCount: number) => void;
  onOpenTurnDiff: (checkpointTurnCount: number, filePath?: string) => void;
  onJumpToEarlierMessages: () => void;
};

export function ThreadTimelineRow({
  row,
  collapsed,
  streamingAssistantMessageId,
  streamingToolGroupId,
  expandedToolGroupIds,
  expandedDiffTrees,
  onToggleRowCollapse,
  onToggleToolCallExpansion,
  onToggleToolGroupExpansion,
  onToggleDiffTree,
  onOpenTurnDiff,
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
