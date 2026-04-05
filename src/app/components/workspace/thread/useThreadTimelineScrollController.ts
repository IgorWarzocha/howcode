import type { Virtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { CHAT_AUTO_SCROLL_BOTTOM_THRESHOLD_PX, isScrollContainerNearBottom } from "./chat-scroll";

type ScrollMetrics = {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
};

export function useThreadTimelineScrollController({
  bottomSentinelRef,
  composerLayoutVersion,
  containerRef,
  effectiveCollapsedRowIds,
  onLoadEarlierMessages,
  rowStructureSignature,
  rowVirtualizer,
  rowsLength,
  setCollapsedRowIds,
  setExpandedDiffTrees,
  setExpandedToolGroupIds,
  streamingToolGroupId,
  streamingTurnRowId,
  timelineRootRef,
  virtualMeasureSignature,
  bottomAnchorKey,
}: {
  bottomSentinelRef: React.RefObject<HTMLDivElement | null>;
  composerLayoutVersion: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  effectiveCollapsedRowIds: Record<string, boolean>;
  onLoadEarlierMessages: () => void;
  rowStructureSignature: string;
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  rowsLength: number;
  setCollapsedRowIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setExpandedDiffTrees: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  setExpandedToolGroupIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  streamingToolGroupId: string | null;
  streamingTurnRowId: string | null;
  timelineRootRef: React.RefObject<HTMLDivElement | null>;
  virtualMeasureSignature: string;
  bottomAnchorKey: string;
}) {
  const shouldStickToBottomRef = useRef(true);
  const lastKnownContainerMetricsRef = useRef<ScrollMetrics | null>(null);
  const pendingResizeMetricsRef = useRef<ScrollMetrics | null>(null);
  const pendingResizeStickyRef = useRef<boolean | null>(null);
  const lastKnownScrollTopRef = useRef(0);
  const isPointerScrollActiveRef = useRef(false);
  const lastTouchClientYRef = useRef<number | null>(null);
  const pendingUserScrollUpIntentRef = useRef(false);
  const pendingInteractionAnchorRef = useRef<{ element: HTMLElement; top: number } | null>(null);
  const pendingExpandedRowRevealRef = useRef<string | null>(null);
  const pendingExpandedRowRevealFrameRef = useRef<number | null>(null);
  const pendingHistoryPrependRef = useRef<{ scrollTop: number; scrollHeight: number } | null>(null);
  const suppressAutoScrollRef = useRef(false);
  const suppressAutoScrollTimerRef = useRef<number | null>(null);
  const pendingAutoScrollFrameRef = useRef<number | null>(null);
  const pendingInteractionAnchorFrameRef = useRef<number | null>(null);
  const pendingMeasureFrameRef = useRef<number | null>(null);
  const pendingResizeAdjustmentFrameRef = useRef<number | null>(null);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const bottomSentinel = bottomSentinelRef.current;
      if (bottomSentinel) {
        bottomSentinel.scrollIntoView({ block: "end", behavior });
      } else {
        container.scrollTo({ top: container.scrollHeight, behavior });
      }

      container.scrollTop = container.scrollHeight;
      lastKnownScrollTopRef.current = container.scrollTop;
      lastKnownContainerMetricsRef.current = {
        scrollTop: container.scrollTop,
        clientHeight: container.clientHeight,
        scrollHeight: container.scrollHeight,
      };
      shouldStickToBottomRef.current = true;
    },
    [bottomSentinelRef, containerRef],
  );

  const cancelPendingScrollToBottom = useCallback(() => {
    if (pendingAutoScrollFrameRef.current === null) {
      return;
    }

    window.cancelAnimationFrame(pendingAutoScrollFrameRef.current);
    pendingAutoScrollFrameRef.current = null;
  }, []);

  const scheduleScrollToBottom = useCallback(() => {
    if (!shouldStickToBottomRef.current || suppressAutoScrollRef.current) {
      return;
    }

    if (pendingAutoScrollFrameRef.current !== null) {
      return;
    }

    pendingAutoScrollFrameRef.current = window.requestAnimationFrame(() => {
      pendingAutoScrollFrameRef.current = null;
      scrollToBottom();
    });
  }, [scrollToBottom]);

  const cancelPendingInteractionAnchorAdjustment = useCallback(() => {
    if (pendingInteractionAnchorFrameRef.current === null) {
      return;
    }

    window.cancelAnimationFrame(pendingInteractionAnchorFrameRef.current);
    pendingInteractionAnchorFrameRef.current = null;
  }, []);

  const suppressAutoScrollTemporarily = useCallback(() => {
    if (shouldStickToBottomRef.current) {
      return;
    }

    suppressAutoScrollRef.current = true;

    if (suppressAutoScrollTimerRef.current !== null) {
      window.clearTimeout(suppressAutoScrollTimerRef.current);
    }

    suppressAutoScrollTimerRef.current = window.setTimeout(() => {
      suppressAutoScrollRef.current = false;
      suppressAutoScrollTimerRef.current = null;
    }, 180);
  }, []);

  useLayoutEffect(() => {
    void bottomAnchorKey;
    void rowStructureSignature;

    const container = containerRef.current;
    const pendingHistoryPrepend = pendingHistoryPrependRef.current;

    if (container && pendingHistoryPrepend) {
      const delta = container.scrollHeight - pendingHistoryPrepend.scrollHeight;
      container.scrollTop = pendingHistoryPrepend.scrollTop + Math.max(0, delta);
      pendingHistoryPrependRef.current = null;
      lastKnownScrollTopRef.current = container.scrollTop;
      lastKnownContainerMetricsRef.current = {
        scrollTop: container.scrollTop,
        clientHeight: container.clientHeight,
        scrollHeight: container.scrollHeight,
      };
      return;
    }

    if (!rowsLength) {
      return;
    }

    scheduleScrollToBottom();
  }, [bottomAnchorKey, containerRef, rowStructureSignature, rowsLength, scheduleScrollToBottom]);

  useLayoutEffect(() => {
    if (composerLayoutVersion <= 0) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const stickyBeforeLayout = shouldStickToBottomRef.current;
    const previousScrollTop = container.scrollTop;

    const frameId = window.requestAnimationFrame(() => {
      const activeContainer = containerRef.current;
      if (!activeContainer) {
        return;
      }

      rowVirtualizer.measure();

      if (stickyBeforeLayout) {
        scrollToBottom();
      } else {
        activeContainer.scrollTop = previousScrollTop;
        lastKnownScrollTopRef.current = activeContainer.scrollTop;
        lastKnownContainerMetricsRef.current = {
          scrollTop: activeContainer.scrollTop,
          clientHeight: activeContainer.clientHeight,
          scrollHeight: activeContainer.scrollHeight,
        };
      }
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [composerLayoutVersion, containerRef, rowVirtualizer, scrollToBottom]);

  useLayoutEffect(() => {
    void virtualMeasureSignature;
    rowVirtualizer.measure();
  }, [rowVirtualizer, virtualMeasureSignature]);

  useLayoutEffect(() => {
    void rowStructureSignature;

    const rowId = pendingExpandedRowRevealRef.current;
    if (!rowId) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (pendingExpandedRowRevealFrameRef.current !== null) {
      window.cancelAnimationFrame(pendingExpandedRowRevealFrameRef.current);
    }

    pendingExpandedRowRevealFrameRef.current = window.requestAnimationFrame(() => {
      pendingExpandedRowRevealFrameRef.current = null;

      const activeContainer = containerRef.current;
      if (!activeContainer) {
        return;
      }

      const rowElement = Array.from(
        activeContainer.querySelectorAll<HTMLElement>("[data-timeline-row-id]"),
      ).find((element) => element.dataset.timelineRowId === rowId);
      if (!rowElement) {
        return;
      }

      const anchorElement =
        rowElement.querySelector<HTMLElement>("[data-row-toggle-anchor='true']") ?? rowElement;
      const containerRect = activeContainer.getBoundingClientRect();
      const anchorRect = anchorElement.getBoundingClientRect();
      const desiredTop = containerRect.top + 12;
      const delta = anchorRect.top - desiredTop;

      if (Math.abs(delta) >= 0.5) {
        activeContainer.scrollTop += delta;
      }

      lastKnownScrollTopRef.current = activeContainer.scrollTop;
      shouldStickToBottomRef.current = false;
      pendingExpandedRowRevealRef.current = null;
    });

    return () => {
      if (pendingExpandedRowRevealFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingExpandedRowRevealFrameRef.current);
        pendingExpandedRowRevealFrameRef.current = null;
      }
    };
  }, [containerRef, rowStructureSignature]);

  useEffect(() => {
    rowVirtualizer.shouldAdjustScrollPositionOnItemSizeChange = (_item, _delta, instance) => {
      const viewportHeight = instance.scrollRect?.height ?? 0;
      const scrollOffset = instance.scrollOffset ?? 0;
      const remainingDistance = instance.getTotalSize() - (scrollOffset + viewportHeight);

      return remainingDistance > CHAT_AUTO_SCROLL_BOTTOM_THRESHOLD_PX;
    };

    return () => {
      rowVirtualizer.shouldAdjustScrollPositionOnItemSizeChange = undefined;
    };
  }, [rowVirtualizer]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: these mutable refs are intentionally read from `.current` without re-rendering so the scroll controller can react to live DOM state.
  useEffect(() => {
    const container = containerRef.current;
    const timelineRoot = timelineRootRef.current;
    if (!container || !timelineRoot || typeof ResizeObserver === "undefined") {
      return;
    }

    lastKnownContainerMetricsRef.current = {
      scrollTop: container.scrollTop,
      clientHeight: container.clientHeight,
      scrollHeight: container.scrollHeight,
    };

    const observer = new ResizeObserver(() => {
      if (pendingResizeMetricsRef.current === null) {
        pendingResizeMetricsRef.current = lastKnownContainerMetricsRef.current ?? {
          scrollTop: container.scrollTop,
          clientHeight: container.clientHeight,
          scrollHeight: container.scrollHeight,
        };
        pendingResizeStickyRef.current = shouldStickToBottomRef.current;
      }

      if (pendingMeasureFrameRef.current !== null) {
        return;
      }

      pendingMeasureFrameRef.current = window.requestAnimationFrame(() => {
        pendingMeasureFrameRef.current = null;
        const previousMetrics = pendingResizeMetricsRef.current ??
          lastKnownContainerMetricsRef.current ?? {
            scrollTop: container.scrollTop,
            clientHeight: container.clientHeight,
            scrollHeight: container.scrollHeight,
          };
        const stickyBeforeResize = pendingResizeStickyRef.current ?? shouldStickToBottomRef.current;
        pendingResizeMetricsRef.current = null;
        pendingResizeStickyRef.current = null;

        rowVirtualizer.measure();

        if (pendingResizeAdjustmentFrameRef.current !== null) {
          window.cancelAnimationFrame(pendingResizeAdjustmentFrameRef.current);
        }

        pendingResizeAdjustmentFrameRef.current = window.requestAnimationFrame(() => {
          pendingResizeAdjustmentFrameRef.current = null;

          const activeContainer = containerRef.current;
          if (!activeContainer) {
            return;
          }

          const shouldPinToBottom = !suppressAutoScrollRef.current && stickyBeforeResize;

          if (shouldPinToBottom) {
            const bottomSentinel = bottomSentinelRef.current;
            if (bottomSentinel) {
              bottomSentinel.scrollIntoView({ block: "end" });
            }
            activeContainer.scrollTop = activeContainer.scrollHeight;
          } else {
            activeContainer.scrollTop = previousMetrics.scrollTop;
          }

          shouldStickToBottomRef.current = stickyBeforeResize;
          lastKnownScrollTopRef.current = activeContainer.scrollTop;
          lastKnownContainerMetricsRef.current = {
            scrollTop: activeContainer.scrollTop,
            clientHeight: activeContainer.clientHeight,
            scrollHeight: activeContainer.scrollHeight,
          };
        });
      });
    });

    observer.observe(container);
    observer.observe(timelineRoot);

    return () => {
      observer.disconnect();
      if (pendingMeasureFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingMeasureFrameRef.current);
        pendingMeasureFrameRef.current = null;
      }

      if (pendingResizeAdjustmentFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingResizeAdjustmentFrameRef.current);
        pendingResizeAdjustmentFrameRef.current = null;
      }
    };
  }, [rowVirtualizer]);

  useEffect(() => {
    return () => {
      cancelPendingInteractionAnchorAdjustment();
      cancelPendingScrollToBottom();

      if (suppressAutoScrollTimerRef.current !== null) {
        window.clearTimeout(suppressAutoScrollTimerRef.current);
      }

      if (pendingMeasureFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingMeasureFrameRef.current);
        pendingMeasureFrameRef.current = null;
      }

      if (pendingResizeAdjustmentFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingResizeAdjustmentFrameRef.current);
        pendingResizeAdjustmentFrameRef.current = null;
      }

      if (pendingExpandedRowRevealFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingExpandedRowRevealFrameRef.current);
        pendingExpandedRowRevealFrameRef.current = null;
      }
    };
  }, [cancelPendingInteractionAnchorAdjustment, cancelPendingScrollToBottom]);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const currentScrollTop = container.scrollTop;
    const isNearBottom = isScrollContainerNearBottom(
      container,
      CHAT_AUTO_SCROLL_BOTTOM_THRESHOLD_PX,
    );

    if (!shouldStickToBottomRef.current && isNearBottom) {
      shouldStickToBottomRef.current = true;
      pendingUserScrollUpIntentRef.current = false;
    } else if (shouldStickToBottomRef.current && pendingUserScrollUpIntentRef.current) {
      if (currentScrollTop < lastKnownScrollTopRef.current - 1) {
        shouldStickToBottomRef.current = false;
      }
      pendingUserScrollUpIntentRef.current = false;
    } else if (shouldStickToBottomRef.current && isPointerScrollActiveRef.current) {
      if (currentScrollTop < lastKnownScrollTopRef.current - 1) {
        shouldStickToBottomRef.current = false;
      }
    } else if (shouldStickToBottomRef.current && !isNearBottom) {
      if (currentScrollTop < lastKnownScrollTopRef.current - 1) {
        shouldStickToBottomRef.current = false;
      }
    }

    lastKnownScrollTopRef.current = currentScrollTop;
    lastKnownContainerMetricsRef.current = {
      scrollTop: container.scrollTop,
      clientHeight: container.clientHeight,
      scrollHeight: container.scrollHeight,
    };
  }, [containerRef]);

  const handleScrollClickCapture = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      if (!container || !(event.target instanceof Element)) {
        return;
      }

      const trigger = event.target.closest<HTMLElement>(
        "button, summary, [role='button'], [data-scroll-anchor-target]",
      );
      if (!trigger || !container.contains(trigger)) {
        return;
      }

      if (trigger.closest("[data-scroll-anchor-ignore]")) {
        return;
      }

      pendingInteractionAnchorRef.current = {
        element: trigger,
        top: trigger.getBoundingClientRect().top,
      };

      cancelPendingInteractionAnchorAdjustment();
      pendingInteractionAnchorFrameRef.current = window.requestAnimationFrame(() => {
        pendingInteractionAnchorFrameRef.current = null;

        const anchor = pendingInteractionAnchorRef.current;
        pendingInteractionAnchorRef.current = null;
        const activeContainer = containerRef.current;
        if (!anchor || !activeContainer) {
          return;
        }

        if (!anchor.element.isConnected || !activeContainer.contains(anchor.element)) {
          return;
        }

        const nextTop = anchor.element.getBoundingClientRect().top;
        const delta = nextTop - anchor.top;
        if (Math.abs(delta) < 0.5) {
          return;
        }

        activeContainer.scrollTop += delta;
        lastKnownScrollTopRef.current = activeContainer.scrollTop;
      });
    },
    [cancelPendingInteractionAnchorAdjustment, containerRef],
  );

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (event.deltaY < 0) {
      pendingUserScrollUpIntentRef.current = true;
    }
  }, []);

  const handlePointerDown = useCallback(() => {
    isPointerScrollActiveRef.current = true;
  }, []);

  const handlePointerUp = useCallback(() => {
    isPointerScrollActiveRef.current = false;
  }, []);

  const handlePointerCancel = useCallback(() => {
    isPointerScrollActiveRef.current = false;
  }, []);

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) {
      return;
    }

    lastTouchClientYRef.current = touch.clientY;
  }, []);

  const handleTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) {
      return;
    }

    const previousTouchY = lastTouchClientYRef.current;
    if (previousTouchY !== null && touch.clientY > previousTouchY + 1) {
      pendingUserScrollUpIntentRef.current = true;
    }

    lastTouchClientYRef.current = touch.clientY;
  }, []);

  const handleTouchEnd = useCallback(() => {
    lastTouchClientYRef.current = null;
  }, []);

  const handleToggleToolCallExpansion = useCallback(() => {
    suppressAutoScrollTemporarily();
  }, [suppressAutoScrollTemporarily]);

  const handleToggleToolGroupExpansion = useCallback(
    (groupId: string) => {
      if (groupId === streamingToolGroupId) {
        return;
      }

      suppressAutoScrollTemporarily();
      setExpandedToolGroupIds((current) => ({
        ...current,
        [groupId]: !current[groupId],
      }));
    },
    [setExpandedToolGroupIds, streamingToolGroupId, suppressAutoScrollTemporarily],
  );

  const handleToggleRowCollapse = useCallback(
    (rowId: string) => {
      if (rowId === streamingTurnRowId) {
        return;
      }

      const isExpanding = Boolean(effectiveCollapsedRowIds[rowId]);
      suppressAutoScrollTemporarily();

      if (isExpanding) {
        shouldStickToBottomRef.current = false;
        pendingExpandedRowRevealRef.current = rowId;
        pendingInteractionAnchorRef.current = null;
        cancelPendingScrollToBottom();
        cancelPendingInteractionAnchorAdjustment();
      }

      setCollapsedRowIds((current) => ({
        ...current,
        [rowId]: !current[rowId],
      }));
    },
    [
      cancelPendingInteractionAnchorAdjustment,
      cancelPendingScrollToBottom,
      effectiveCollapsedRowIds,
      setCollapsedRowIds,
      streamingTurnRowId,
      suppressAutoScrollTemporarily,
    ],
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
    suppressAutoScrollTemporarily();
    onLoadEarlierMessages();
  }, [containerRef, onLoadEarlierMessages, suppressAutoScrollTemporarily]);

  const handleToggleDiffTree = useCallback(
    (checkpointTurnCount: number) => {
      suppressAutoScrollTemporarily();
      setExpandedDiffTrees((current) => ({
        ...current,
        [checkpointTurnCount]: current[checkpointTurnCount] === false,
      }));
    },
    [setExpandedDiffTrees, suppressAutoScrollTemporarily],
  );

  return {
    handleJumpToEarlierMessages,
    handlePointerCancel,
    handlePointerDown,
    handlePointerUp,
    handleScroll,
    handleScrollClickCapture,
    handleToggleDiffTree,
    handleToggleRowCollapse,
    handleToggleToolCallExpansion,
    handleToggleToolGroupExpansion,
    handleTouchEnd,
    handleTouchMove,
    handleTouchStart,
    handleWheel,
  };
}
