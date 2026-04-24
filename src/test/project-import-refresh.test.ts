import { describe, expect, it } from "vitest";
import { getProjectImportRefreshError } from "../../desktop/pi-threads/project-import-refresh";

describe("project import refresh gating", () => {
  it("allows import-all after a successful shell index refresh", () => {
    expect(
      getProjectImportRefreshError({ mode: "import", projectIds: [], refreshed: true }),
    ).toBeNull();
  });

  it("blocks import-all when the shell index refresh fails", () => {
    expect(getProjectImportRefreshError({ mode: "import", projectIds: [], refreshed: false })).toBe(
      "Could not refresh Pi sessions before importing projects.",
    );
  });

  it("keeps explicit project imports best-effort when refresh fails", () => {
    expect(
      getProjectImportRefreshError({ mode: "scan", projectIds: ["/repo"], refreshed: false }),
    ).toBeNull();
  });
});
