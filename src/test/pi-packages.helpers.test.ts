import { describe, expect, it } from "vitest";
import {
  getConfiguredPiPackageType,
  getPiPackageIdentityKey,
  normalizePiPackageSource,
  sortPiPackageCatalogItems,
} from "../../desktop/pi-packages.helpers";

describe("pi packages helpers", () => {
  it("normalizes npm and git sources for install requests", () => {
    expect(normalizePiPackageSource("taskplane", "npm")).toBe("npm:taskplane");
    expect(normalizePiPackageSource("npm:pi-subagents@1.0.0", "npm")).toBe(
      "npm:pi-subagents@1.0.0",
    );
    expect(normalizePiPackageSource("github.com/user/repo", "git")).toBe(
      "git:github.com/user/repo",
    );
    expect(normalizePiPackageSource("https://github.com/user/repo", "git")).toBe(
      "https://github.com/user/repo",
    );
  });

  it("derives stable identity keys for configured packages", () => {
    expect(getPiPackageIdentityKey("npm:@scope/pkg@1.2.3")).toBe("npm:@scope/pkg");
    expect(getPiPackageIdentityKey("git:github.com/user/repo@v1")).toBe("git:github.com/user/repo");
  });

  it("detects configured package source types", () => {
    expect(getConfiguredPiPackageType("npm:taskplane")).toBe("npm");
    expect(getConfiguredPiPackageType("git:github.com/user/repo")).toBe("git");
    expect(getConfiguredPiPackageType("./local-extension")).toBe("local");
  });

  it("sorts package search results by popularity first", () => {
    const items = sortPiPackageCatalogItems([
      {
        name: "beta",
        version: "1.0.0",
        description: null,
        keywords: ["pi-package"],
        monthlyDownloads: 100,
        weeklyDownloads: 10,
        searchScore: 10,
        publishedAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
        npmUrl: "https://npmjs.com/beta",
        homepageUrl: null,
        repositoryUrl: null,
        source: "npm:beta",
        identityKey: "npm:beta",
      },
      {
        name: "alpha",
        version: "1.0.0",
        description: null,
        keywords: ["pi-package"],
        monthlyDownloads: 100,
        weeklyDownloads: 25,
        searchScore: 5,
        publishedAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
        npmUrl: "https://npmjs.com/alpha",
        homepageUrl: null,
        repositoryUrl: null,
        source: "npm:alpha",
        identityKey: "npm:alpha",
      },
      {
        name: "gamma",
        version: "1.0.0",
        description: null,
        keywords: ["pi-package"],
        monthlyDownloads: 250,
        weeklyDownloads: 8,
        searchScore: 1,
        publishedAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
        npmUrl: "https://npmjs.com/gamma",
        homepageUrl: null,
        repositoryUrl: null,
        source: "npm:gamma",
        identityKey: "npm:gamma",
      },
    ]);

    expect(items.map((item) => item.name)).toEqual(["gamma", "alpha", "beta"]);
  });
});
