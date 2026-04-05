import { useCallback } from "react";
import { CHAT_AUTO_SCROLL_BOTTOM_THRESHOLD_PX, isScrollContainerNearBottom } from "./chat-scroll";
import type { ThreadTimelineScrollHelpers } from "./useThreadTimelineScrollHelpers";
import type { ThreadTimelineScrollState } from "./useThreadTimelineScrollState";

export function useThreadTimelineScrollInteractions({
  containerRef,
  effectiveCollapsedRowIds,
  onLoadEarlierMessages,
  setCollapsedRowIds,
  setExpandedDiffTrees,
  setExpandedToolGroupIds,
  state,
  streamingToolGroupId,
  streamingTurnRowId,
  helpers,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  effectiveCollapsedRowIds: Record<string, boolean>;
  onLoadEarlierMessages: () => void;
  setCollapsedRowIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setExpandedDiffTrees: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  setExpandedToolGroupIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  state: ThreadTimelineScrollState;
  streamingToolGroupId: string | null;
  streamingTurnRowId: string | null;
  helpers: ThreadTimelineScrollHelpers;
}) {
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

    if (!state.shouldStickToBottomRef.current && isNearBottom) {
      state.shouldStickToBottomRef.current = true;
      state.pendingUserScrollUpIntentRef.current = false;
    } else if (state.shouldStickToBottomRef.current && state.pendingUserScrollUpIntentRef.current) {
      if (currentScrollTop < state.lastKnownScrollTopRef.current - 1) {
        state.shouldStickToBottomRef.current = false;
      }
      state.pendingUserScrollUpIntentRef.current = false;
    } else if (state.shouldStickToBottomRef.current && state.isPointerScrollActiveRef.current) {
      if (currentScrollTop < state.lastKnownScrollTopRef.current - 1) {
        state.shouldStickToBottomRef.current = false;
      }
    } else if (state.shouldStickToBottomRef.current && !isNearBottom) {
      if (currentScrollTop < state.lastKnownScrollTopRef.current - 1) {
        state.shouldStickToBottomRef.current = false;
      }
    }

    state.lastKnownScrollTopRef.current = currentScrollTop;
    state.lastKnownContainerMetricsRef.current = {
      scrollTop: container.scrollTop,
      clientHeight: container.clientHeight,
      scrollHeight: container.scrollHeight,
    };
  }, [containerRef, state]);

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

      state.pendingInteractionAnchorRef.current = {
        element: trigger,
        top: trigger.getBoundingClientRect().top,
      };

      helpers.cancelPendingInteractionAnchorAdjustment();
      state.pendingInteractionAnchorFrameRef.current = window.requestAnimationFrame(() => {
        state.pendingInteractionAnchorFrameRef.current = null;

        const anchor = state.pendingInteractionAnchorRef.current;
        state.pendingInteractionAnchorRef.current = null;
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
        state.lastKnownScrollTopRef.current = activeContainer.scrollTop;
      });
    },
    [containerRef, helpers, state],
  );

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (event.deltaY < 0) {
        state.pendingUserScrollUpIntentRef.current = true;
      }
    },
    [state],
  );

  const handlePointerDown = useCallback(() => {
    state.isPointerScrollActiveRef.current = true;
  }, [state]);

  const handlePointerUp = useCallback(() => {
    state.isPointerScrollActiveRef.current = false;
  }, [state]);

  const handlePointerCancel = useCallback(() => {
    state.isPointerScrollActiveRef.current = false;
  }, [state]);

  const handleTouchStart = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      const touch = event.touches[0];
      if (!touch) {
        return;
      }

      state.lastTouchClientYRef.current = touch.clientY;
    },
    [state],
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      const touch = event.touches[0];
      if (!touch) {
        return;
      }

      const previousTouchY = state.lastTouchClientYRef.current;
      if (previousTouchY !== null && touch.clientY > previousTouchY + 1) {
        state.pendingUserScrollUpIntentRef.current = true;
      }

      state.lastTouchClientYRef.current = touch.clientY;
    },
    [state],
  );

  const handleTouchEnd = useCallback(() => {
    state.lastTouchClientYRef.current = null;
  }, [state]);

  const handleToggleToolCallExpansion = useCallback(() => {
    helpers.suppressAutoScrollTemporarily();
  }, [helpers]);

  const handleToggleToolGroupExpansion = useCallback(
    (groupId: string) => {
      if (groupId === streamingToolGroupId) {
        return;
      }

      helpers.suppressAutoScrollTemporarily();
      setExpandedToolGroupIds((current) => ({
        ...current,
        [groupId]: !current[groupId],
      }));
    },
    [helpers, setExpandedToolGroupIds, streamingToolGroupId],
  );

  const handleToggleRowCollapse = useCallback(
    (rowId: string) => {
      if (rowId === streamingTurnRowId) {
        return;
      }

      const isExpanding = Boolean(effectiveCollapsedRowIds[rowId]);
      helpers.suppressAutoScrollTemporarily();

      if (isExpanding) {
        state.shouldStickToBottomRef.current = false;
        state.pendingExpandedRowRevealRef.current = rowId;
        state.pendingInteractionAnchorRef.current = null;
        helpers.cancelPendingScrollToBottom();
        helpers.cancelPendingInteractionAnchorAdjustment();
      }

      setCollapsedRowIds((current) => ({
        ...current,
        [rowId]: !current[rowId],
      }));
    },
    [effectiveCollapsedRowIds, helpers, setCollapsedRowIds, state, streamingTurnRowId],
  );

  const handleJumpToEarlierMessages = useCallback(() => {
    const container = containerRef.current;
    if (container) {
      state.pendingHistoryPrependRef.current = {
        scrollTop: container.scrollTop,
        scrollHeight: container.scrollHeight,
      };
    }

    state.shouldStickToBottomRef.current = false;
    helpers.suppressAutoScrollTemporarily();
    onLoadEarlierMessages();
  }, [containerRef, helpers, onLoadEarlierMessages, state]);

  const handleToggleDiffTree = useCallback(
    (checkpointTurnCount: number) => {
      helpers.suppressAutoScrollTemporarily();
      setExpandedDiffTrees((current) => ({
        ...current,
        [checkpointTurnCount]: current[checkpointTurnCount] === false,
      }));
    },
    [helpers, setExpandedDiffTrees],
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
