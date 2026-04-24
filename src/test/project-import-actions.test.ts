import { describe, expect, it, vi } from "vitest";
import { resolveProjectImportActionResult } from "../../desktop/pi-threads/project-import-action";

describe("project import actions", () => {
  it("refreshes session discovery before import-all and imports with empty project ids", async () => {
    const refreshShellIndex = vi.fn().mockResolvedValue(true);
    const importProjects = vi.fn().mockResolvedValue({
      checkedProjectCount: 1,
      importedProjectIds: ["/new-project"],
      originProjectCount: 0,
      repoProjectCount: 0,
    });

    const result = await resolveProjectImportActionResult({
      cwd: "/active-project",
      mode: "import",
      projectIds: [],
      refreshOptions: { emitRefreshEvent: false, force: true },
      refreshShellIndex,
      runAfterRefresh: importProjects,
    });

    expect(refreshShellIndex).toHaveBeenCalledWith("/active-project", {
      emitRefreshEvent: false,
      force: true,
    });
    expect(importProjects).toHaveBeenCalledWith([]);
    expect(result).toEqual({
      checkedProjectCount: 1,
      importedProjectIds: ["/new-project"],
      originProjectCount: 0,
      repoProjectCount: 0,
    });
  });

  it("blocks import-all when the session refresh fails", async () => {
    const refreshShellIndex = vi.fn().mockResolvedValue(false);
    const importProjects = vi.fn();

    const result = await resolveProjectImportActionResult({
      cwd: "/active-project",
      mode: "import",
      projectIds: [],
      refreshOptions: { emitRefreshEvent: false },
      refreshShellIndex,
      runAfterRefresh: importProjects,
    });

    expect(importProjects).not.toHaveBeenCalled();
    expect(result).toEqual({
      error: "Could not refresh Pi sessions before importing projects.",
    });
  });

  it("keeps explicit project imports best-effort when the refresh fails", async () => {
    const refreshShellIndex = vi.fn().mockResolvedValue(false);
    const importProjects = vi.fn().mockResolvedValue({ importedProjectIds: ["/known-project"] });

    await resolveProjectImportActionResult({
      cwd: "/active-project",
      mode: "import",
      projectIds: ["/known-project"],
      refreshOptions: { emitRefreshEvent: false },
      refreshShellIndex,
      runAfterRefresh: importProjects,
    });

    expect(importProjects).toHaveBeenCalledWith(["/known-project"]);
  });
});
