import { describe, expect, it } from "vitest";
import {
  implementedDesktopActions,
  unimplementedDesktopActions,
} from "../../shared/desktop-action-coverage";
import { desktopActions } from "../../shared/desktop-actions";

describe("desktop action coverage", () => {
  it("partitions every declared desktop action exactly once", () => {
    const coveredActions = [...implementedDesktopActions, ...unimplementedDesktopActions];

    expect(new Set(coveredActions).size).toBe(coveredActions.length);
    expect([...coveredActions].sort()).toEqual([...desktopActions].sort());
  });
});
