import { useCallback } from "react";
import type { ThreadTimelineScrollState } from "./useThreadTimelineScrollState";

export type ThreadTimelineScrollHelpers = {
  cancelPendingInteractionAnchorAdjustment: () => void;
  cancelPendingScrollToBottom: () => void;
  scheduleScrollToBottom: () => void;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  suppressAutoScrollTemporarily: () => void;
};

export function useThreadTimelineScrollHelpers({
  bottomSentinelRef,
  containerRef,
  state,
}: {
  bottomSentinelRef: React.RefObject<HTMLDivElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  state: ThreadTimelineScrollState;
}): ThreadTimelineScrollHelpers {
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
      state.lastKnownScrollTopRef.current = container.scrollTop;
      state.lastKnownContainerMetricsRef.current = {
        scrollTop: container.scrollTop,
        clientHeight: container.clientHeight,
        scrollHeight: container.scrollHeight,
      };
      state.shouldStickToBottomRef.current = true;
    },
    [bottomSentinelRef, containerRef, state],
  );

  const cancelPendingScrollToBottom = useCallback(() => {
    if (state.pendingAutoScrollFrameRef.current === null) {
      return;
    }

    window.cancelAnimationFrame(state.pendingAutoScrollFrameRef.current);
    state.pendingAutoScrollFrameRef.current = null;
  }, [state]);

  const scheduleScrollToBottom = useCallback(() => {
    if (!state.shouldStickToBottomRef.current || state.suppressAutoScrollRef.current) {
      return;
    }

    if (state.pendingAutoScrollFrameRef.current !== null) {
      return;
    }

    state.pendingAutoScrollFrameRef.current = window.requestAnimationFrame(() => {
      state.pendingAutoScrollFrameRef.current = null;
      scrollToBottom();
    });
  }, [scrollToBottom, state]);

  const cancelPendingInteractionAnchorAdjustment = useCallback(() => {
    if (state.pendingInteractionAnchorFrameRef.current === null) {
      return;
    }

    window.cancelAnimationFrame(state.pendingInteractionAnchorFrameRef.current);
    state.pendingInteractionAnchorFrameRef.current = null;
  }, [state]);

  const suppressAutoScrollTemporarily = useCallback(() => {
    if (state.shouldStickToBottomRef.current) {
      return;
    }

    state.suppressAutoScrollRef.current = true;

    if (state.suppressAutoScrollTimerRef.current !== null) {
      window.clearTimeout(state.suppressAutoScrollTimerRef.current);
    }

    state.suppressAutoScrollTimerRef.current = window.setTimeout(() => {
      state.suppressAutoScrollRef.current = false;
      state.suppressAutoScrollTimerRef.current = null;
    }, 180);
  }, [state]);

  return {
    cancelPendingInteractionAnchorAdjustment,
    cancelPendingScrollToBottom,
    scheduleScrollToBottom,
    scrollToBottom,
    suppressAutoScrollTemporarily,
  };
}
