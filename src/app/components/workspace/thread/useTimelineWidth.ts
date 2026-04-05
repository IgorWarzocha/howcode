import { useLayoutEffect, useState } from "react";

export function useTimelineWidth(timelineRootRef: React.RefObject<HTMLDivElement | null>) {
  const [timelineWidthPx, setTimelineWidthPx] = useState<number | null>(null);

  useLayoutEffect(() => {
    const timelineRoot = timelineRootRef.current;
    if (!timelineRoot) {
      return;
    }

    const updateWidth = (nextWidth: number) => {
      setTimelineWidthPx((current) => {
        if (current !== null && Math.abs(current - nextWidth) < 0.5) {
          return current;
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

    return () => {
      observer.disconnect();
    };
  }, [timelineRootRef]);

  return timelineWidthPx;
}
