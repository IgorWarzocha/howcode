import type { Virtualizer } from "@tanstack/react-virtual";
import { useEffect, useLayoutEffect } from "react";
import { CHAT_AUTO_SCROLL_BOTTOM_THRESHOLD_PX } from "./chat-scroll";
import type { ThreadTimelineScrollHelpers } from "./useThreadTimelineScrollHelpers";
import type { ThreadTimelineScrollState } from "./useThreadTimelineScrollState";

export function useThreadTimelineScrollEffects({
  bottomAnchorKey,
  bottomSentinelRef,
  composerLayoutVersion,
  containerRef,
  rowStructureSignature,
  rowVirtualizer,
  rowsLength,
  state,
  timelineRootRef,
  virtualMeasureSignature,
  helpers,
}: {
  bottomAnchorKey: string;
  bottomSentinelRef: React.RefObject<HTMLDivElement | null>;
  composerLayoutVersion: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  rowStructureSignature: string;
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  rowsLength: number;
  state: ThreadTimelineScrollState;
  timelineRootRef: React.RefObject<HTMLDivElement | null>;
  virtualMeasureSignature: string;
  helpers: ThreadTimelineScrollHelpers;
}) {
  useLayoutEffect(() => {
    void bottomAnchorKey;
    void rowStructureSignature;

    const container = containerRef.current;
    const pendingHistoryPrepend = state.pendingHistoryPrependRef.current;

    if (container && pendingHistoryPrepend) {
      const delta = container.scrollHeight - pendingHistoryPrepend.scrollHeight;
      container.scrollTop = pendingHistoryPrepend.scrollTop + Math.max(0, delta);
      state.pendingHistoryPrependRef.current = null;
      state.lastKnownScrollTopRef.current = container.scrollTop;
      state.lastKnownContainerMetricsRef.current = {
        scrollTop: container.scrollTop,
        clientHeight: container.clientHeight,
        scrollHeight: container.scrollHeight,
      };
      return;
    }

    if (!rowsLength) {
      return;
    }

    helpers.scheduleScrollToBottom();
  }, [bottomAnchorKey, containerRef, helpers, rowStructureSignature, rowsLength, state]);

  useLayoutEffect(() => {
    if (composerLayoutVersion <= 0) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const stickyBeforeLayout = state.shouldStickToBottomRef.current;
    const previousScrollTop = container.scrollTop;

    const frameId = window.requestAnimationFrame(() => {
      const activeContainer = containerRef.current;
      if (!activeContainer) {
        return;
      }

      rowVirtualizer.measure();

      if (stickyBeforeLayout) {
        helpers.scrollToBottom();
      } else {
        activeContainer.scrollTop = previousScrollTop;
        state.lastKnownScrollTopRef.current = activeContainer.scrollTop;
        state.lastKnownContainerMetricsRef.current = {
          scrollTop: activeContainer.scrollTop,
          clientHeight: activeContainer.clientHeight,
          scrollHeight: activeContainer.scrollHeight,
        };
      }
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [composerLayoutVersion, containerRef, helpers, rowVirtualizer, state]);

  useLayoutEffect(() => {
    void virtualMeasureSignature;
    rowVirtualizer.measure();
  }, [rowVirtualizer, virtualMeasureSignature]);

  useLayoutEffect(() => {
    void rowStructureSignature;

    const rowId = state.pendingExpandedRowRevealRef.current;
    if (!rowId) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (state.pendingExpandedRowRevealFrameRef.current !== null) {
      window.cancelAnimationFrame(state.pendingExpandedRowRevealFrameRef.current);
    }

    state.pendingExpandedRowRevealFrameRef.current = window.requestAnimationFrame(() => {
      state.pendingExpandedRowRevealFrameRef.current = null;

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

      state.lastKnownScrollTopRef.current = activeContainer.scrollTop;
      state.shouldStickToBottomRef.current = false;
      state.pendingExpandedRowRevealRef.current = null;
    });

    return () => {
      if (state.pendingExpandedRowRevealFrameRef.current !== null) {
        window.cancelAnimationFrame(state.pendingExpandedRowRevealFrameRef.current);
        state.pendingExpandedRowRevealFrameRef.current = null;
      }
    };
  }, [containerRef, rowStructureSignature, state]);

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

  useEffect(() => {
    const container = containerRef.current;
    const timelineRoot = timelineRootRef.current;
    if (!container || !timelineRoot || typeof ResizeObserver === "undefined") {
      return;
    }

    state.lastKnownContainerMetricsRef.current = {
      scrollTop: container.scrollTop,
      clientHeight: container.clientHeight,
      scrollHeight: container.scrollHeight,
    };

    const observer = new ResizeObserver(() => {
      if (state.pendingResizeMetricsRef.current === null) {
        state.pendingResizeMetricsRef.current = state.lastKnownContainerMetricsRef.current ?? {
          scrollTop: container.scrollTop,
          clientHeight: container.clientHeight,
          scrollHeight: container.scrollHeight,
        };
        state.pendingResizeStickyRef.current = state.shouldStickToBottomRef.current;
      }

      if (state.pendingMeasureFrameRef.current !== null) {
        return;
      }

      state.pendingMeasureFrameRef.current = window.requestAnimationFrame(() => {
        state.pendingMeasureFrameRef.current = null;
        const previousMetrics = state.pendingResizeMetricsRef.current ??
          state.lastKnownContainerMetricsRef.current ?? {
            scrollTop: container.scrollTop,
            clientHeight: container.clientHeight,
            scrollHeight: container.scrollHeight,
          };
        const stickyBeforeResize =
          state.pendingResizeStickyRef.current ?? state.shouldStickToBottomRef.current;
        state.pendingResizeMetricsRef.current = null;
        state.pendingResizeStickyRef.current = null;

        rowVirtualizer.measure();

        if (state.pendingResizeAdjustmentFrameRef.current !== null) {
          window.cancelAnimationFrame(state.pendingResizeAdjustmentFrameRef.current);
        }

        state.pendingResizeAdjustmentFrameRef.current = window.requestAnimationFrame(() => {
          state.pendingResizeAdjustmentFrameRef.current = null;

          const activeContainer = containerRef.current;
          if (!activeContainer) {
            return;
          }

          const shouldPinToBottom = !state.suppressAutoScrollRef.current && stickyBeforeResize;

          if (shouldPinToBottom) {
            const bottomSentinel = bottomSentinelRef.current;
            if (bottomSentinel) {
              bottomSentinel.scrollIntoView({ block: "end" });
            }
            activeContainer.scrollTop = activeContainer.scrollHeight;
          } else {
            activeContainer.scrollTop = previousMetrics.scrollTop;
          }

          state.shouldStickToBottomRef.current = stickyBeforeResize;
          state.lastKnownScrollTopRef.current = activeContainer.scrollTop;
          state.lastKnownContainerMetricsRef.current = {
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
      if (state.pendingMeasureFrameRef.current !== null) {
        window.cancelAnimationFrame(state.pendingMeasureFrameRef.current);
        state.pendingMeasureFrameRef.current = null;
      }

      if (state.pendingResizeAdjustmentFrameRef.current !== null) {
        window.cancelAnimationFrame(state.pendingResizeAdjustmentFrameRef.current);
        state.pendingResizeAdjustmentFrameRef.current = null;
      }
    };
  }, [bottomSentinelRef, containerRef, rowVirtualizer, state, timelineRootRef]);

  useEffect(() => {
    return () => {
      helpers.cancelPendingInteractionAnchorAdjustment();
      helpers.cancelPendingScrollToBottom();

      if (state.suppressAutoScrollTimerRef.current !== null) {
        window.clearTimeout(state.suppressAutoScrollTimerRef.current);
      }

      if (state.pendingMeasureFrameRef.current !== null) {
        window.cancelAnimationFrame(state.pendingMeasureFrameRef.current);
        state.pendingMeasureFrameRef.current = null;
      }

      if (state.pendingResizeAdjustmentFrameRef.current !== null) {
        window.cancelAnimationFrame(state.pendingResizeAdjustmentFrameRef.current);
        state.pendingResizeAdjustmentFrameRef.current = null;
      }

      if (state.pendingExpandedRowRevealFrameRef.current !== null) {
        window.cancelAnimationFrame(state.pendingExpandedRowRevealFrameRef.current);
        state.pendingExpandedRowRevealFrameRef.current = null;
      }
    };
  }, [helpers, state]);
}
