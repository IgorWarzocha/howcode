import { describe, expect, it } from "vitest";
import {
  buildGitOpsCommentCards,
  getActionResultCommitted,
  getActionResultError,
  getActionResultMessage,
  getActionResultPreviewed,
} from "../app/components/workspace/composer/composer-git-ops.helpers";
import type { DesktopActionResult } from "../app/desktop/types";

describe("composer git ops helpers", () => {
  it("reads action result flags and messages", () => {
    const result: DesktopActionResult = {
      ok: true,
      at: new Date(0).toISOString(),
      payload: { action: "workspace.commit", payload: {} },
      result: {
        committed: true,
        previewed: true,
        message: "Committed successfully",
        error: "push failed",
      },
    };

    expect(getActionResultMessage(result)).toBe("Committed successfully");
    expect(getActionResultCommitted(result)).toBe(true);
    expect(getActionResultPreviewed(result)).toBe(true);
    expect(getActionResultError(result)).toBe("push failed");
  });

  it("builds comment cards with normalized filenames and line labels", () => {
    expect(
      buildGitOpsCommentCards([
        {
          id: "comment-1",
          fileKey: "src/app/index.ts",
          filePath: "src/app/index.ts",
          side: "additions",
          lineNumber: 12,
          body: "Tighten this branch.",
          createdAt: "2026-04-04T00:00:00.000Z",
        },
        {
          id: "comment-2",
          fileKey: "src/app/view.tsx",
          filePath: "src/app/view.tsx",
          side: "deletions",
          lineNumber: 8,
          endSide: "additions",
          endLineNumber: 10,
          body: "Should this move?",
          createdAt: "2026-04-04T00:00:00.000Z",
        },
      ]),
    ).toEqual([
      {
        id: "comment-1",
        filePath: "src/app/index.ts",
        fileName: "index.ts",
        linesLabel: "Ln 12",
      },
      {
        id: "comment-2",
        filePath: "src/app/view.tsx",
        fileName: "view.tsx",
        linesLabel: "Ln 8:10",
      },
    ]);
  });
});
