import { useRef } from "react";

export type ScrollMetrics = {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
};

export type ThreadTimelineScrollState = {
  shouldStickToBottomRef: React.MutableRefObject<boolean>;
  lastKnownContainerMetricsRef: React.MutableRefObject<ScrollMetrics | null>;
  pendingResizeMetricsRef: React.MutableRefObject<ScrollMetrics | null>;
  pendingResizeStickyRef: React.MutableRefObject<boolean | null>;
  lastKnownScrollTopRef: React.MutableRefObject<number>;
  isPointerScrollActiveRef: React.MutableRefObject<boolean>;
  lastTouchClientYRef: React.MutableRefObject<number | null>;
  pendingUserScrollUpIntentRef: React.MutableRefObject<boolean>;
  pendingInteractionAnchorRef: React.MutableRefObject<{ element: HTMLElement; top: number } | null>;
  pendingExpandedRowRevealRef: React.MutableRefObject<string | null>;
  pendingExpandedRowRevealFrameRef: React.MutableRefObject<number | null>;
  pendingHistoryPrependRef: React.MutableRefObject<{
    scrollTop: number;
    scrollHeight: number;
  } | null>;
  suppressAutoScrollRef: React.MutableRefObject<boolean>;
  suppressAutoScrollTimerRef: React.MutableRefObject<number | null>;
  pendingAutoScrollFrameRef: React.MutableRefObject<number | null>;
  pendingInteractionAnchorFrameRef: React.MutableRefObject<number | null>;
  pendingMeasureFrameRef: React.MutableRefObject<number | null>;
  pendingResizeAdjustmentFrameRef: React.MutableRefObject<number | null>;
};

export function useThreadTimelineScrollState(): ThreadTimelineScrollState {
  return {
    shouldStickToBottomRef: useRef(true),
    lastKnownContainerMetricsRef: useRef<ScrollMetrics | null>(null),
    pendingResizeMetricsRef: useRef<ScrollMetrics | null>(null),
    pendingResizeStickyRef: useRef<boolean | null>(null),
    lastKnownScrollTopRef: useRef(0),
    isPointerScrollActiveRef: useRef(false),
    lastTouchClientYRef: useRef<number | null>(null),
    pendingUserScrollUpIntentRef: useRef(false),
    pendingInteractionAnchorRef: useRef<{ element: HTMLElement; top: number } | null>(null),
    pendingExpandedRowRevealRef: useRef<string | null>(null),
    pendingExpandedRowRevealFrameRef: useRef<number | null>(null),
    pendingHistoryPrependRef: useRef<{ scrollTop: number; scrollHeight: number } | null>(null),
    suppressAutoScrollRef: useRef(false),
    suppressAutoScrollTimerRef: useRef<number | null>(null),
    pendingAutoScrollFrameRef: useRef<number | null>(null),
    pendingInteractionAnchorFrameRef: useRef<number | null>(null),
    pendingMeasureFrameRef: useRef<number | null>(null),
    pendingResizeAdjustmentFrameRef: useRef<number | null>(null),
  };
}
