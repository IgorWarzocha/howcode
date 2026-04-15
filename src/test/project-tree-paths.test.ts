import { describe, expect, it } from "vitest";
import { isProtectedProjectDeletionTarget } from "../app/components/sidebar/project-tree/project-tree-paths";

describe("project tree path helpers", () => {
  it("blocks deleting the active project and its ancestors", () => {
    expect(isProtectedProjectDeletionTarget("/repo/app", "/repo/app")).toBe(true);
    expect(isProtectedProjectDeletionTarget("/repo", "/repo/app")).toBe(true);
    expect(isProtectedProjectDeletionTarget("/other", "/repo/app")).toBe(false);
  });

  it("normalizes trailing separators and windows-style paths", () => {
    expect(isProtectedProjectDeletionTarget("/repo/", "/repo/app")).toBe(true);
    expect(isProtectedProjectDeletionTarget("C:\\Repo", "c:\\repo\\app")).toBe(true);
    expect(isProtectedProjectDeletionTarget("C:\\Other", "c:\\repo\\app")).toBe(false);
  });
});
