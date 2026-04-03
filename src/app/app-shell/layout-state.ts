import {
  DIFF_OVERLAY_BREAKPOINT_PX,
  DIFF_PANEL_MAX_WIDTH_PX,
  DIFF_PANEL_MIN_WIDTH_PX,
} from "../ui/layout";

export function clampDiffPanelWidth(width: number) {
  return Math.max(DIFF_PANEL_MIN_WIDTH_PX, Math.min(DIFF_PANEL_MAX_WIDTH_PX, width));
}

export function getDiffLayoutState({
  diffVisible,
  takeoverVisible,
  mainSectionWidth,
}: {
  diffVisible: boolean;
  takeoverVisible: boolean;
  mainSectionWidth: number | null;
}) {
  const diffPanelVisible = diffVisible && !takeoverVisible;
  const overlayDiffVisible =
    diffPanelVisible && mainSectionWidth !== null && mainSectionWidth < DIFF_OVERLAY_BREAKPOINT_PX;

  return {
    diffPanelVisible,
    overlayDiffVisible,
    splitDiffVisible: diffPanelVisible && !overlayDiffVisible,
  };
}
