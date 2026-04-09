import { describe, expect, it } from "vitest";
import {
  getProjectSelectionAction,
  shouldResetProjectScope,
} from "../app/app-shell/scoped-project-view";

describe("scoped project view", () => {
  it("keeps project selection local while browsing scoped install views", () => {
    expect(getProjectSelectionAction("extensions")).toBe("set-selected-project");
    expect(getProjectSelectionAction("skills")).toBe("set-selected-project");
    expect(getProjectSelectionAction("code")).toBe("select-project");
  });

  it("resets scoped project state once the user leaves the scoped view", () => {
    expect(shouldResetProjectScope("code", "extensions")).toBe(true);
    expect(shouldResetProjectScope("skills", "extensions")).toBe(true);
    expect(shouldResetProjectScope("extensions", "extensions")).toBe(false);
  });
});
