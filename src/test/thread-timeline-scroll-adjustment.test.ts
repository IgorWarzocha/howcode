import { describe, expect, it } from "vitest";

import {
  getResizeAdjustmentMode,
  hasPendingExpandedRowReveal,
  shouldAdjustVirtualScrollPositionOnItemSizeChange,
} from "../app/components/workspace/thread/thread-timeline-scroll-adjustment";

describe("thread timeline scroll adjustment helpers", () => {
  it("detects pending expanded-row reveal work", () => {
    expect(
      hasPendingExpandedRowReveal({
        pendingExpandedRowRevealRef: { current: "summary:1" },
        pendingExpandedRowRevealFrameRef: { current: null },
      }),
    ).toBe(true);

    expect(
      hasPendingExpandedRowReveal({
        pendingExpandedRowRevealRef: { current: null },
        pendingExpandedRowRevealFrameRef: { current: 12 },
      }),
    ).toBe(true);

    expect(
      hasPendingExpandedRowReveal({
        pendingExpandedRowRevealRef: { current: null },
        pendingExpandedRowRevealFrameRef: { current: null },
      }),
    ).toBe(false);
  });

  it("disables virtual scroll adjustment while an expanded row is being revealed", () => {
    expect(
      shouldAdjustVirtualScrollPositionOnItemSizeChange({
        hasPendingExpandedReveal: true,
        remainingDistance: 900,
        thresholdPx: 160,
      }),
    ).toBe(false);

    expect(
      shouldAdjustVirtualScrollPositionOnItemSizeChange({
        hasPendingExpandedReveal: false,
        remainingDistance: 900,
        thresholdPx: 160,
      }),
    ).toBe(true);
  });

  it("preserves the current scroll position during expanded-row reveal resize work", () => {
    expect(
      getResizeAdjustmentMode({
        hasPendingExpandedReveal: true,
        stickyBeforeResize: false,
        suppressAutoScroll: false,
      }),
    ).toBe("preserve-current");
  });

  it("still pins to bottom when sticky and not revealing an expanded row", () => {
    expect(
      getResizeAdjustmentMode({
        hasPendingExpandedReveal: false,
        stickyBeforeResize: true,
        suppressAutoScroll: false,
      }),
    ).toBe("pin-bottom");
  });

  it("restores the previous scroll position for ordinary non-sticky resizes", () => {
    expect(
      getResizeAdjustmentMode({
        hasPendingExpandedReveal: false,
        stickyBeforeResize: false,
        suppressAutoScroll: true,
      }),
    ).toBe("restore-previous");
  });
});
