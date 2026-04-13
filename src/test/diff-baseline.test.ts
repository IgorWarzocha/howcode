import { describe, expect, it } from "vitest";
import {
  defaultDiffBaseline,
  getDiffBaselineLabel,
  getDiffBaselinePrefix,
  getResolvedDiffBaselineLabel,
} from "../app/components/workspace/composer/diff-baseline";

describe("diff baseline helpers", () => {
  it("uses from/since prefixes for branch and commit baselines", () => {
    expect(defaultDiffBaseline).toEqual({ kind: "head" });
    expect(getDiffBaselinePrefix({ kind: "main-branch" })).toBe("from");
    expect(getDiffBaselinePrefix({ kind: "dev-branch" })).toBe("from");
    expect(getDiffBaselinePrefix({ kind: "commit", sha: "abcdef123456" })).toBe("since");
  });

  it("formats selected commit labels from commit metadata or the sha fallback", () => {
    expect(
      getDiffBaselineLabel({ kind: "commit", sha: "abcdef123456" }, [
        {
          sha: "abcdef123456",
          shortSha: "abcdef1",
          subject: "Add tests",
          authorName: "Pi",
          authorEmail: "pi@example.com",
          authoredAt: "2026-04-01T00:00:00.000Z",
          committedAt: "2026-04-01T00:00:00.000Z",
          decorations: [],
          isHead: false,
        },
      ]),
    ).toBe("abcdef1");

    expect(getDiffBaselineLabel({ kind: "commit", sha: "1234567890ab" })).toBe("1234567");
  });

  it("formats resolved commit labels from short shas, commit shas, or a fallback", () => {
    expect(
      getResolvedDiffBaselineLabel(
        { kind: "commit", sha: "abcdef123456" },
        {
          kind: "commit",
          rev: "abcdef123456",
          label: "selected",
          commitSha: "abcdef123456",
          shortSha: "abcdef1",
          subject: "Add tests",
          committedAt: "2026-04-01T00:00:00.000Z",
          capturedAt: null,
        },
      ),
    ).toBe("abcdef1");

    expect(
      getResolvedDiffBaselineLabel(
        { kind: "commit", sha: "abcdef123456" },
        {
          kind: "commit",
          rev: "abcdef123456",
          label: "selected",
          commitSha: "1234567890ab",
          shortSha: null,
          subject: null,
          committedAt: null,
          capturedAt: null,
        },
      ),
    ).toBe("1234567");

    expect(getResolvedDiffBaselineLabel({ kind: "commit", sha: "abcdef123456" }, null)).toBe(
      "that commit",
    );
  });
});
