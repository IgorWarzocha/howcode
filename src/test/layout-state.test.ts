import { describe, expect, it } from "vitest";
import { clampDiffPanelWidth, getDiffLayoutState } from "../app/app-shell/layout-state";

describe("layout-state", () => {
  it("clamps diff panel widths to the standardized range", () => {
    expect(clampDiffPanelWidth(100)).toBe(400);
    expect(clampDiffPanelWidth(560)).toBe(560);
    expect(clampDiffPanelWidth(999)).toBe(800);
  });

  it("chooses split vs overlay diff layout deterministically", () => {
    expect(
      getDiffLayoutState({ diffVisible: true, takeoverVisible: false, mainSectionWidth: 900 }),
    ).toEqual({ diffPanelVisible: true, overlayDiffVisible: true, splitDiffVisible: false });

    expect(
      getDiffLayoutState({ diffVisible: true, takeoverVisible: false, mainSectionWidth: 1400 }),
    ).toEqual({ diffPanelVisible: true, overlayDiffVisible: false, splitDiffVisible: true });
  });
});
