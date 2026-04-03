import { describe, expect, it } from "vitest";
import {
  getRenderablePatch,
  joinProjectFilePath,
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
});
