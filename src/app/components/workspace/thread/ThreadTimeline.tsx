import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Message } from "../../../types";
import { CHAT_TEXT_MAX_WIDTH_CLASS } from "../../../ui/layout";
import { ThreadTimelineRow } from "./ThreadTimelineRow";
import { buildTimelineRows } from "./buildTimelineRows";
import { CHAT_AUTO_SCROLL_BOTTOM_THRESHOLD_PX, isScrollContainerNearBottom } from "./chat-scroll";
import { chatScrollableAreaClass, chatViewportClass } from "./thread-layout";
import { buildThreadTimelineState } from "./thread-timeline-state";
import type { TimelineRow } from "./timeline-row";

type ThreadTimelineProps = {
  messages: Message[];
  previousMessageCount: number;
  isStreaming: boolean;
  isCompacting: boolean;
  composerLayoutVersion: number;
  onLoadEarlierMessages: () => void;
};

export function ThreadTimeline({
  messages,
  previousMessageCount,
  isStreaming,
  isCompacting,
  composerLayoutVersion,
  onLoadEarlierMessages,
}: ThreadTimelineProps) {
  const [collapsedRowIds, setCollapsedRowIds] = useState<Record<string, boolean>>({});
  const [expandedToolGroupIds, setExpandedToolGroupIds] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const programmaticScrollFrameRef = useRef<number | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const pendingHistoryPrependRef = useRef<{ scrollTop: number; scrollHeight: number } | null>(null);

  const rows = useMemo<TimelineRow[]>(
    () => buildTimelineRows({ messages, previousMessageCount }),
    [messages, previousMessageCount],
  );

  const {
    bottomAnchorKey,
    effectiveCollapsedRowIds,
    foldableRows,
    latestTurnRowId,
    rowStructureSignature,
    streamingAssistantMessageId,
    streamingToolGroupId,
    streamingTurnRowId,
  } = useMemo(
    () =>
      buildThreadTimelineState({
        rows,
        messages,
        isStreaming,
        collapsedRowIds,
        expandedToolGroupIds,
      }),
    [collapsedRowIds, expandedToolGroupIds, isStreaming, messages, rows],
  );

  useEffect(() => {
    setCollapsedRowIds((current) => {
      const next = foldableRows.reduce<Record<string, boolean>>((result, row) => {
        if (row.id === streamingTurnRowId) {
          result[row.id] = false;
          return result;
        }

        if (Object.prototype.hasOwnProperty.call(current, row.id)) {
          result[row.id] = current[row.id] as boolean;
          return result;
        }

        result[row.id] = row.id !== latestTurnRowId;
        return result;
      }, {});

      const currentKeys = Object.keys(current);
      const nextKeys = Object.keys(next);
      if (
        currentKeys.length === nextKeys.length &&
        nextKeys.every((key) => current[key] === next[key])
      ) {
        return current;
      }

      return next;
    });
  }, [foldableRows, latestTurnRowId, streamingTurnRowId]);

  const scrollToBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (programmaticScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(programmaticScrollFrameRef.current);
    }

    container.scrollTop = container.scrollHeight;
    programmaticScrollFrameRef.current = window.requestAnimationFrame(() => {
      programmaticScrollFrameRef.current = null;
    });
  }, []);

  useEffect(
    () => () => {
      if (programmaticScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(programmaticScrollFrameRef.current);
      }
    },
    [],
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      if (shouldStickToBottomRef.current) {
        scrollToBottom();
      }
    });

    observer.observe(container);
    observer.observe(content);

    return () => {
      observer.disconnect();
    };
  }, [scrollToBottom]);

  useLayoutEffect(() => {
    void bottomAnchorKey;
    void composerLayoutVersion;
    void rowStructureSignature;

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const pendingHistoryPrepend = pendingHistoryPrependRef.current;
    if (pendingHistoryPrepend) {
      const delta = container.scrollHeight - pendingHistoryPrepend.scrollHeight;
      container.scrollTop = pendingHistoryPrepend.scrollTop + Math.max(0, delta);
      pendingHistoryPrependRef.current = null;
      return;
    }

    if (!rows.length) {
      return;
    }

    if (shouldStickToBottomRef.current) {
      scrollToBottom();
    }
  }, [bottomAnchorKey, composerLayoutVersion, rowStructureSignature, rows.length, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (programmaticScrollFrameRef.current !== null) {
      return;
    }

    shouldStickToBottomRef.current = isScrollContainerNearBottom(
      {
        scrollTop: container.scrollTop,
        clientHeight: container.clientHeight,
        scrollHeight: container.scrollHeight,
      },
      CHAT_AUTO_SCROLL_BOTTOM_THRESHOLD_PX,
    );
  }, []);

  const handleToggleRowCollapse = useCallback(
    (rowId: string) => {
      if (rowId === streamingTurnRowId) {
        return;
      }

      shouldStickToBottomRef.current = false;
      setCollapsedRowIds((current) => ({
        ...current,
        [rowId]: !current[rowId],
      }));
    },
    [streamingTurnRowId],
  );

  const handleToggleToolCallExpansion = useCallback(() => {
    shouldStickToBottomRef.current = false;
  }, []);

  const handleToggleToolGroupExpansion = useCallback(
    (groupId: string) => {
      if (groupId === streamingToolGroupId) {
        return;
      }

      shouldStickToBottomRef.current = false;
      setExpandedToolGroupIds((current) => ({
        ...current,
        [groupId]: !current[groupId],
      }));
    },
    [streamingToolGroupId],
  );

  const handleJumpToEarlierMessages = useCallback(() => {
    const container = containerRef.current;
    if (container) {
      pendingHistoryPrependRef.current = {
        scrollTop: container.scrollTop,
        scrollHeight: container.scrollHeight,
      };
    }

    shouldStickToBottomRef.current = false;
    onLoadEarlierMessages();
  }, [onLoadEarlierMessages]);

  const renderRow = useCallback(
    (row: TimelineRow) => (
      <div key={row.id} className="min-w-0" data-timeline-row-id={row.id}>
        <ThreadTimelineRow
          row={row}
          collapsed={Boolean(effectiveCollapsedRowIds[row.id])}
          streamingAssistantMessageId={streamingAssistantMessageId}
          streamingToolGroupId={streamingToolGroupId}
          expandedToolGroupIds={expandedToolGroupIds}
          onToggleRowCollapse={handleToggleRowCollapse}
          onToggleToolCallExpansion={handleToggleToolCallExpansion}
          onToggleToolGroupExpansion={handleToggleToolGroupExpansion}
          onJumpToEarlierMessages={handleJumpToEarlierMessages}
        />
      </div>
    ),
    [
      effectiveCollapsedRowIds,
      expandedToolGroupIds,
      handleJumpToEarlierMessages,
      handleToggleRowCollapse,
      handleToggleToolCallExpansion,
      handleToggleToolGroupExpansion,
      streamingAssistantMessageId,
      streamingToolGroupId,
    ],
  );

  return (
    <div className={`${chatViewportClass} relative`}>
      <div ref={containerRef} className={chatScrollableAreaClass} onScroll={handleScroll}>
        <div
          ref={contentRef}
          className={`mx-auto w-full min-w-0 ${CHAT_TEXT_MAX_WIDTH_CLASS} overflow-x-hidden px-4 pt-4 pb-4`}
        >
          <div className="grid min-w-0 gap-4">{rows.map(renderRow)}</div>
          <div ref={bottomSentinelRef} aria-hidden="true" className="h-px w-full" />
        </div>
      </div>
      {isCompacting ? (
        <div className="pointer-events-none absolute right-4 bottom-4 left-4 z-20 flex justify-center">
          <div className="rounded-full border border-[rgba(155,183,255,0.18)] bg-[#2d3040] px-3 py-2 text-[13px] text-[#cbd7ff] shadow-[0_18px_44px_rgba(0,0,0,0.36)]">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#9bb7ff]" />
              <span>Compacting session context…</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
