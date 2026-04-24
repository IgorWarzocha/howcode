import { describe, expect, it } from "vitest";
import { isSmallAppWindow, SMALL_WINDOW_MINIMUM_SIZE } from "../app/app-shell/small-window";

describe("small window overlay", () => {
  it("uses the temporary half-HD threshold", () => {
    expect(SMALL_WINDOW_MINIMUM_SIZE).toEqual({ width: 960, height: 540 });
  });

  it("shows when either dimension is below the minimum", () => {
    expect(isSmallAppWindow({ width: 959, height: 600 })).toBe(true);
    expect(isSmallAppWindow({ width: 1200, height: 539 })).toBe(true);
  });

  it("hides when both dimensions meet the minimum", () => {
    expect(isSmallAppWindow({ width: 960, height: 540 })).toBe(false);
    expect(isSmallAppWindow({ width: 1200, height: 800 })).toBe(false);
  });
});
