import type { ThreadTimelineScrollState } from "./useThreadTimelineScrollState";

export function hasPendingExpandedRowReveal(
  state: Pick<
    ThreadTimelineScrollState,
    "pendingExpandedRowRevealFrameRef" | "pendingExpandedRowRevealRef"
  >,
) {
  return (
    state.pendingExpandedRowRevealRef.current !== null ||
    state.pendingExpandedRowRevealFrameRef.current !== null
  );
}

export function shouldAdjustVirtualScrollPositionOnItemSizeChange({
  hasPendingExpandedReveal,
  remainingDistance,
  thresholdPx,
}: {
  hasPendingExpandedReveal: boolean;
  remainingDistance: number;
  thresholdPx: number;
}) {
  return !hasPendingExpandedReveal && remainingDistance > thresholdPx;
}

export function getResizeAdjustmentMode({
  hasPendingExpandedReveal,
  stickyBeforeResize,
  suppressAutoScroll,
}: {
  hasPendingExpandedReveal: boolean;
  stickyBeforeResize: boolean;
  suppressAutoScroll: boolean;
}) {
  if (hasPendingExpandedReveal) {
    return "preserve-current" as const;
  }

  return !suppressAutoScroll && stickyBeforeResize
    ? ("pin-bottom" as const)
    : ("restore-previous" as const);
}
