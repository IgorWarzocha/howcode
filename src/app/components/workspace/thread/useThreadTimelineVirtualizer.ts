import { measureElement as measureVirtualElement, useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { estimateThreadTimelineRowHeight } from "./estimateThreadTimelineRowHeight";
import {
  CHAT_BOTTOM_PADDING_PX,
  CHAT_ROW_GAP_PX,
  CHAT_STICKY_BOTTOM_THRESHOLD_PX,
  CHAT_TOP_PADDING_PX,
} from "./thread-layout";
import { getCollapsibleRowKey } from "./thread-timeline-signatures";
import type { TimelineRow } from "./timeline-row";

type UseThreadTimelineVirtualizerInput = {
  rows: TimelineRow[];
  collapsedRowIds: Record<string, boolean>;
  rowStructureSignature: string;
  bottomAnchorKey: string;
  isStreaming: boolean;
};

export function useThreadTimelineVirtualizer({
  rows,
  collapsedRowIds,
  rowStructureSignature,
  bottomAnchorKey,
  isStreaming,
}: UseThreadTimelineVirtualizerInput) {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRootRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const suppressScrollAdjustRef = useRef(false);
  const suppressScrollAdjustTimerRef = useRef<number | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const [timelineWidthPx, setTimelineWidthPx] = useState<number | null>(null);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    getItemKey: (index) => {
      const row = rows[index];
      if (!row) {
        return index;
      }

      return getCollapsibleRowKey(row, collapsedRowIds);
    },
    estimateSize: (index) => {
      const row = rows[index] ?? { kind: "history-divider", id: "missing", hiddenCount: 0 };
      return estimateThreadTimelineRowHeight(row, {
        collapsed:
          row.kind === "turn" || row.kind === "summary" ? Boolean(collapsedRowIds[row.id]) : false,
      });
    },
    measureElement: measureVirtualElement,
    useAnimationFrameWithResizeObserver: true,
    overscan: 8,
    gap: CHAT_ROW_GAP_PX,
  });

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

  useEffect(() => {
    if (timelineWidthPx === null) {
      return;
    }

    rowVirtualizer.measure();
  }, [rowVirtualizer, timelineWidthPx]);

  useLayoutEffect(() => {
    void rowStructureSignature;
    rowVirtualizer.measure();
  }, [rowStructureSignature, rowVirtualizer]);

  useEffect(() => {
    rowVirtualizer.shouldAdjustScrollPositionOnItemSizeChange = (_item, _delta, instance) => {
      if (suppressScrollAdjustRef.current) {
        return false;
      }

      if (shouldStickToBottomRef.current) {
        return true;
      }

      const viewportHeight = instance.scrollRect?.height ?? 0;
      const scrollOffset = instance.scrollOffset ?? 0;
      const remainingDistance = instance.getTotalSize() - (scrollOffset + viewportHeight);
      return remainingDistance > CHAT_STICKY_BOTTOM_THRESHOLD_PX;
    };

    return () => {
      rowVirtualizer.shouldAdjustScrollPositionOnItemSizeChange = undefined;
    };
  }, [rowVirtualizer]);

  const scrollToBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (isStreaming) {
      container.scrollTo({ top: container.scrollHeight });
      return;
    }

    rowVirtualizer.scrollToOffset(rowVirtualizer.getTotalSize(), { align: "end" });

    window.requestAnimationFrame(() => {
      const nextContainer = containerRef.current;
      if (!nextContainer) {
        return;
      }

      nextContainer.scrollTo({ top: nextContainer.scrollHeight });
    });
  }, [isStreaming, rowVirtualizer]);

  useLayoutEffect(() => {
    void bottomAnchorKey;
    void rowStructureSignature;

    if (!rows.length || !shouldStickToBottomRef.current) {
      return;
    }

    if (scrollFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollFrameRef.current);
    }

    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollToBottom();
      scrollFrameRef.current = null;
    });
  }, [bottomAnchorKey, rowStructureSignature, rows.length, scrollToBottom]);

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

  const suppressScrollAdjustTemporarily = useCallback(() => {
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
    shouldStickToBottomRef.current = distanceFromBottom <= CHAT_STICKY_BOTTOM_THRESHOLD_PX;
  }, []);

  return {
    containerRef,
    timelineRootRef,
    rowVirtualizer,
    virtualRows: rowVirtualizer.getVirtualItems(),
    totalHeightPx: rowVirtualizer.getTotalSize() + CHAT_TOP_PADDING_PX + CHAT_BOTTOM_PADDING_PX,
    handleScroll,
    suppressScrollAdjustTemporarily,
  };
}
