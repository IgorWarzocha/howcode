import { describe, expect, it } from "vitest";
import {
  buildDraftTarget,
  buildFileDiffRenderKey,
  describeCollapsedLines,
  describeCommentTarget,
  formatTurnChipTimestamp,
  getFileChangeCounts,
  getFileHeaderContextLabel,
  getRenderablePatch,
  isSameDraftTarget,
  joinProjectFilePath,
  orderRenderableFiles,
  orderTurnDiffSummaries,
  resolveFileDiffPath,
} from "../app/components/workspace/diff/diff-panel-content.helpers";

describe("diff panel helpers", () => {
  it("normalizes diff file paths and project file joins", () => {
    expect(resolveFileDiffPath({ name: "a/src/app.ts" } as never)).toBe("src/app.ts");
    expect(joinProjectFilePath("/repo/", "./src/app.ts")).toBe("/repo/src/app.ts");
  });

  it("sorts turn summaries newest first", () => {
    expect(
      orderTurnDiffSummaries([
        { checkpointTurnCount: 1, completedAt: "2025-01-01T10:00:00.000Z" },
        { checkpointTurnCount: 3, completedAt: "2025-01-01T09:00:00.000Z" },
        { checkpointTurnCount: 3, completedAt: "2025-01-01T11:00:00.000Z" },
      ]),
    ).toEqual([
      { checkpointTurnCount: 3, completedAt: "2025-01-01T11:00:00.000Z" },
      { checkpointTurnCount: 3, completedAt: "2025-01-01T09:00:00.000Z" },
      { checkpointTurnCount: 1, completedAt: "2025-01-01T10:00:00.000Z" },
    ]);
  });

  it("falls back to raw mode for invalid patches", () => {
    expect(getRenderablePatch("not a patch", "test-scope")).toEqual({
      kind: "raw",
      text: "not a patch",
      reason: "Unsupported diff format. Showing raw patch.",
    });
  });

  it("normalizes draft targets and compares them after filling default end positions", () => {
    const target = buildDraftTarget({
      fileKey: "src/app.ts",
      filePath: "src/app.ts",
      side: "additions",
      lineNumber: 12,
    });

    expect(target).toEqual({
      fileKey: "src/app.ts",
      filePath: "src/app.ts",
      side: "additions",
      lineNumber: 12,
    });
    expect(
      isSameDraftTarget(target, {
        fileKey: "src/app.ts",
        side: "additions",
        lineNumber: 12,
        endSide: "additions",
        endLineNumber: 12,
      }),
    ).toBe(true);
  });

  it("describes same-side and cross-side comment targets", () => {
    expect(
      describeCommentTarget({
        side: "deletions",
        lineNumber: 8,
        endLineNumber: 10,
      } as never),
    ).toBe("Old lines 8-10");

    expect(
      describeCommentTarget({
        side: "deletions",
        lineNumber: 8,
        endSide: "additions",
        endLineNumber: 10,
      } as never),
    ).toBe("Old line 8 → New line 10");
  });

  it("computes diff render metadata and change counts", () => {
    const fileDiff = {
      name: "b/src/file10.ts",
      prevName: "a/src/file10.ts",
      cacheKey: "cache-key",
      hunks: [
        { collapsedBefore: 3, additionLines: 2, deletionLines: 1 },
        { collapsedBefore: 0, additionLines: 4, deletionLines: 5 },
      ],
    } as never;

    expect(buildFileDiffRenderKey(fileDiff)).toBe("cache-key");
    expect(getFileHeaderContextLabel(fileDiff)).toBe("3 unmodified lines");
    expect(getFileChangeCounts(fileDiff)).toEqual({ additions: 6, deletions: 6 });
    expect(describeCollapsedLines(1)).toBe("1 unmodified line");
  });

  it("orders renderable files numerically and formats turn timestamps", () => {
    expect(
      orderRenderableFiles([
        { name: "b/src/file10.ts", prevName: "a/src/file10.ts", hunks: [] },
        { name: "b/src/file2.ts", prevName: "a/src/file2.ts", hunks: [] },
      ] as never),
    ).toMatchObject([{ name: "b/src/file2.ts" }, { name: "b/src/file10.ts" }]);

    expect(formatTurnChipTimestamp("2026-04-01T15:30:00.000Z")).toBe(
      new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date("2026-04-01T15:30:00.000Z")),
    );
  });
});
