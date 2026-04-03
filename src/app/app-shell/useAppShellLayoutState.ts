import { type CSSProperties, useEffect, useRef, useState } from "react";
import { useAnimatedPresence } from "../hooks/useAnimatedPresence";
import { DIFF_PANEL_DEFAULT_WIDTH_PX, WORKSPACE_CONTENT_MAX_WIDTH_CLASS } from "../ui/layout";
import { clampDiffPanelWidth, getDiffLayoutState } from "./layout-state";

type UseAppShellLayoutStateInput = {
  diffVisible: boolean;
  takeoverVisible: boolean;
};

export function useAppShellLayoutState({
  diffVisible,
  takeoverVisible,
}: UseAppShellLayoutStateInput) {
  const [diffPanelWidth, setDiffPanelWidth] = useState(DIFF_PANEL_DEFAULT_WIDTH_PX);
  const [mainSectionWidth, setMainSectionWidth] = useState<number | null>(null);
  const resizeStartRef = useRef<{ pointerX: number; width: number } | null>(null);
  const mainSectionRef = useRef<HTMLElement>(null);

  const { diffPanelVisible, overlayDiffVisible, splitDiffVisible } = getDiffLayoutState({
    diffVisible,
    takeoverVisible,
    mainSectionWidth,
  });
  const overlayDiffPresent = useAnimatedPresence(overlayDiffVisible);
  const takeoverPresent = useAnimatedPresence(takeoverVisible);
  const desktopWorkspacePresent = useAnimatedPresence(!takeoverVisible);

  useEffect(() => {
    const element = mainSectionRef.current;
    if (!element) {
      return;
    }

    setMainSectionWidth(element.clientWidth);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      setMainSectionWidth(entry.contentRect.width);
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const resizeStart = resizeStartRef.current;
      if (!resizeStart) {
        return;
      }

      const nextWidth = resizeStart.width - (event.clientX - resizeStart.pointerX);
      setDiffPanelWidth(clampDiffPanelWidth(nextWidth));
    };

    const handlePointerUp = () => {
      resizeStartRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  return {
    mainSectionRef,
    diffPanelVisible,
    overlayDiffVisible,
    splitDiffVisible,
    overlayDiffPresent,
    takeoverPresent,
    desktopWorkspacePresent,
    diffLayoutStyle: splitDiffVisible
      ? ({ "--diff-panel-width": `${diffPanelWidth}px` } as CSSProperties)
      : undefined,
    workspaceContentClass: `mx-auto w-full ${WORKSPACE_CONTENT_MAX_WIDTH_CLASS}`,
    handleDiffResizeStart: (pointerX: number) => {
      resizeStartRef.current = {
        pointerX,
        width: diffPanelWidth,
      };
    },
  };
}
