import { measureElement as measureVirtualElement, useVirtualizer } from "@tanstack/react-virtual";
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { TurnDiffSummary } from "../../../desktop/types";
import type { Message } from "../../../types";
import { ThreadMessage } from "../../common/ThreadMessage";
import { ChangedFilesTree } from "../diff/ChangedFilesTree";
import { ToolCallsCard } from "./ToolCallsCard";
import { estimateThreadTimelineRowHeight } from "./estimateThreadTimelineRowHeight";

const STICKY_BOTTOM_THRESHOLD = 24;
const ROW_GAP_PX = 18;
const TIMELINE_TOP_PADDING_PX = 16;
const TIMELINE_BOTTOM_PADDING_PX = 32;

type VirtualizedThreadTimelineProps = {
  messages: Message[];
  previousMessageCount: number;
  isStreaming: boolean;
  turnDiffSummaries: TurnDiffSummary[];
  onOpenTurnDiff: (checkpointTurnCount: number, filePath?: string) => void;
};

type ToolCallMessage = Extract<Message, { role: "toolResult" | "bashExecution" }>;

type TimelineRow =
  | {
      kind: "history-divider";
      id: string;
      hiddenCount: number;
    }
  | {
      kind: "tool-group";
      id: string;
      messages: ToolCallMessage[];
    }
  | {
      kind: "message";
      id: string;
      message: Message;
      turnSummary?: TurnDiffSummary;
    };

function isToolCallMessage(message: Message): message is ToolCallMessage {
  return message.role === "toolResult" || message.role === "bashExecution";
}

function getMessageRenderSignature(message: Message | undefined) {
  if (!message) {
    return "empty";
  }

  switch (message.role) {
    case "user":
    case "toolResult":
    case "custom":
    case "branchSummary":
    case "compactionSummary":
      return `${message.id}:${message.role}:${message.content.join("\n").length}`;
    case "assistant":
      return `${message.id}:${message.role}:${message.content.join("\n").length}:${message.thinkingContent?.join("\n").length ?? 0}`;
    case "bashExecution":
      return `${message.id}:${message.role}:${message.command.length}:${message.output.join("\n").length}`;
    default:
      return "unknown";
  }
}

export function VirtualizedThreadTimeline({
  messages,
  previousMessageCount,
  isStreaming,
  turnDiffSummaries,
  onOpenTurnDiff,
}: VirtualizedThreadTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRootRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const suppressScrollAdjustRef = useRef(false);
  const suppressScrollAdjustTimerRef = useRef<number | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const [timelineWidthPx, setTimelineWidthPx] = useState<number | null>(null);
  const [expandedDiffTrees, setExpandedDiffTrees] = useState<Record<number, boolean>>({});
  const turnDiffSummaryByAssistantMessageId = useMemo(
    () =>
      new Map(
        turnDiffSummaries
          .filter((summary) => summary.assistantMessageId)
          .map((summary) => [summary.assistantMessageId as string, summary]),
      ),
    [turnDiffSummaries],
  );

  const rows = useMemo<TimelineRow[]>(() => {
    const nextRows: TimelineRow[] = [];
    let pendingToolMessages: ToolCallMessage[] = [];

    const flushPendingToolMessages = () => {
      if (pendingToolMessages.length === 0) {
        return;
      }

      const firstMessage = pendingToolMessages[0];
      const lastMessage = pendingToolMessages[pendingToolMessages.length - 1];
      nextRows.push({
        kind: "tool-group",
        id: `tool-group:${firstMessage?.id ?? "start"}:${lastMessage?.id ?? "end"}:${pendingToolMessages.length}`,
        messages: pendingToolMessages,
      });
      pendingToolMessages = [];
    };

    if (previousMessageCount > 0) {
      nextRows.push({
        kind: "history-divider",
        id: `history-divider:${previousMessageCount}`,
        hiddenCount: previousMessageCount,
      });
    }

    for (const message of messages) {
      if (isToolCallMessage(message)) {
        pendingToolMessages.push(message);
        continue;
      }

      flushPendingToolMessages();

      nextRows.push({
        kind: "message",
        id: message.id,
        message,
        turnSummary:
          message.role === "assistant"
            ? turnDiffSummaryByAssistantMessageId.get(message.id)
            : undefined,
      });
    }

    flushPendingToolMessages();

    return nextRows;
  }, [messages, previousMessageCount, turnDiffSummaryByAssistantMessageId]);
  const bottomAnchorKey = useMemo(
    () =>
      `${getMessageRenderSignature(messages[messages.length - 1])}:${isStreaming ? "streaming" : "idle"}`,
    [isStreaming, messages],
  );
  const streamingAssistantMessageId = useMemo(() => {
    if (!isStreaming) {
      return null;
    }

    const latestAssistantMessage = [...messages]
      .reverse()
      .find((message) => message.role === "assistant");
    return latestAssistantMessage?.id ?? null;
  }, [isStreaming, messages]);

  useLayoutEffect(() => {
    const timelineRoot = timelineRootRef.current;
    if (!timelineRoot) {
      return;
    }

    const updateWidth = (nextWidth: number) => {
      setTimelineWidthPx((previousWidth) => {
        if (previousWidth !== null && Math.abs(previousWidth - nextWidth) < 0.5) {
          return previousWidth;
        }

        return nextWidth;
      });
    };

    updateWidth(timelineRoot.getBoundingClientRect().width);

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateWidth(timelineRoot.getBoundingClientRect().width);
    });
    observer.observe(timelineRoot);

    return () => observer.disconnect();
  }, []);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    getItemKey: (index) => rows[index]?.id ?? index,
    estimateSize: (index) =>
      estimateThreadTimelineRowHeight(rows[index] ?? { kind: "history-divider" }),
    measureElement: measureVirtualElement,
    useAnimationFrameWithResizeObserver: true,
    overscan: 8,
    gap: ROW_GAP_PX,
  });

  useEffect(() => {
    if (timelineWidthPx === null) {
      return;
    }

    rowVirtualizer.measure();
  }, [rowVirtualizer, timelineWidthPx]);

  useEffect(() => {
    rowVirtualizer.shouldAdjustScrollPositionOnItemSizeChange = (_item, _delta, instance) => {
      if (suppressScrollAdjustRef.current) {
        return false;
      }

      const viewportHeight = instance.scrollRect?.height ?? 0;
      const scrollOffset = instance.scrollOffset ?? 0;
      const remainingDistance = instance.getTotalSize() - (scrollOffset + viewportHeight);
      return remainingDistance > STICKY_BOTTOM_THRESHOLD;
    };

    return () => {
      rowVirtualizer.shouldAdjustScrollPositionOnItemSizeChange = undefined;
    };
  }, [rowVirtualizer]);

  useLayoutEffect(() => {
    void bottomAnchorKey;

    if (!rows.length || !shouldStickToBottomRef.current) {
      return;
    }

    if (scrollFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollFrameRef.current);
    }

    scrollFrameRef.current = window.requestAnimationFrame(() => {
      rowVirtualizer.scrollToIndex(rows.length - 1, { align: "end" });
      scrollFrameRef.current = null;
    });
  }, [bottomAnchorKey, rowVirtualizer, rows.length]);

  useEffect(() => {
    return () => {
      if (suppressScrollAdjustTimerRef.current !== null) {
        window.clearTimeout(suppressScrollAdjustTimerRef.current);
      }

      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, []);

  const handleToggleToolCallExpansion = useCallback(() => {
    suppressScrollAdjustRef.current = true;
    if (suppressScrollAdjustTimerRef.current !== null) {
      window.clearTimeout(suppressScrollAdjustTimerRef.current);
    }

    suppressScrollAdjustTimerRef.current = window.setTimeout(() => {
      suppressScrollAdjustRef.current = false;
      suppressScrollAdjustTimerRef.current = null;
    }, 180);
  }, []);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom <= STICKY_BOTTOM_THRESHOLD;
  }, []);

  const renderTimelineRow = (row: TimelineRow) => {
    if (row.kind === "history-divider") {
      return (
        <button
          type="button"
          className="mx-4 flex items-center gap-4 py-1 text-[13px] text-[color:var(--muted-2)]"
          onClick={() => {
            const container = containerRef.current;
            if (!container) {
              return;
            }

            container.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <div className="h-px flex-1 bg-[rgba(161,173,221,0.12)]" />
          <span>{row.hiddenCount} earlier messages</span>
          <div className="h-px flex-1 bg-[rgba(161,173,221,0.12)]" />
        </button>
      );
    }

    if (row.kind === "tool-group") {
      return (
        <ToolCallsCard messages={row.messages} onToggleExpanded={handleToggleToolCallExpansion} />
      );
    }

    const { message, turnSummary } = row;
    const allDirectoriesExpanded =
      turnSummary && expandedDiffTrees[turnSummary.checkpointTurnCount] !== false;

    return (
      <Fragment>
        <ThreadMessage
          message={message}
          autoExpandThinking={message.id === streamingAssistantMessageId}
          onToggleExpanded={handleToggleToolCallExpansion}
        />
        {turnSummary && turnSummary.files.length > 0 ? (
          <div className="px-4">
            <div className="rounded-[16px] border border-[color:var(--border)] bg-[rgba(255,255,255,0.025)] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-[11px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
                  Changed files ({turnSummary.files.length}) · turn{" "}
                  {turnSummary.checkpointTurnCount}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className="rounded-[9px] border border-[color:var(--border)] px-2 py-1 text-[11px] text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)]"
                    onClick={() =>
                      setExpandedDiffTrees((current) => ({
                        ...current,
                        [turnSummary.checkpointTurnCount]: !allDirectoriesExpanded,
                      }))
                    }
                  >
                    {allDirectoriesExpanded ? "Collapse all" : "Expand all"}
                  </button>
                  <button
                    type="button"
                    className="rounded-[9px] border border-[color:var(--border)] px-2 py-1 text-[11px] text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)]"
                    onClick={() =>
                      onOpenTurnDiff(turnSummary.checkpointTurnCount, turnSummary.files[0]?.path)
                    }
                  >
                    View diff
                  </button>
                </div>
              </div>
              <ChangedFilesTree
                checkpointTurnCount={turnSummary.checkpointTurnCount}
                files={turnSummary.files}
                allDirectoriesExpanded={Boolean(allDirectoriesExpanded)}
                onOpenTurnDiff={onOpenTurnDiff}
              />
            </div>
          </div>
        ) : null}
      </Fragment>
    );
  };

  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <div className="mx-auto flex h-full w-full max-w-[744px] overflow-hidden">
      <div
        ref={containerRef}
        className="min-h-0 w-full overflow-y-scroll overflow-x-hidden [scrollbar-gutter:stable]"
        onScroll={handleScroll}
      >
        <div ref={timelineRootRef} className="relative px-4 pt-4 pb-8 [&>*]:min-w-0">
          <div
            className="relative w-full"
            style={{
              height: `${rowVirtualizer.getTotalSize() + TIMELINE_TOP_PADDING_PX + TIMELINE_BOTTOM_PADDING_PX}px`,
            }}
          >
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index];
              if (!row) {
                return null;
              }

              return (
                <div
                  key={virtualRow.key}
                  ref={rowVirtualizer.measureElement}
                  className="absolute top-0 left-0 w-full min-w-0"
                  data-index={virtualRow.index}
                  style={{
                    transform: `translateY(${virtualRow.start + TIMELINE_TOP_PADDING_PX}px)`,
                  }}
                >
                  {renderTimelineRow(row)}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
