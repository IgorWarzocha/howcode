import { describe, expect, it } from "vitest";
import { appShellRootClass } from "../app/app-shell/layout-classes";

describe("app shell layout", () => {
  it("uses the rooted app height instead of viewport units", () => {
    expect(appShellRootClass).toContain("h-full");
    expect(appShellRootClass).toContain("min-h-0");
    expect(appShellRootClass).not.toContain("h-screen");
  });
});
