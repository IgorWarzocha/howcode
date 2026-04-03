import { describe, expect, it } from "vitest";
import { reconcileCollapsedRowIds } from "../app/components/workspace/thread/reconcileCollapsedRowIds";

describe("reconcileCollapsedRowIds", () => {
  it("keeps only the latest turn expanded by default", () => {
    expect(
      reconcileCollapsedRowIds(
        [
          {
            kind: "turn",
            id: "turn:1",
            userMessage: { id: "u1", role: "user", content: [""] },
            items: [],
          },
          {
            kind: "summary",
            id: "summary:1",
            message: { id: "s1", role: "branchSummary", content: [""] },
          },
          {
            kind: "turn",
            id: "turn:2",
            userMessage: { id: "u2", role: "user", content: [""] },
            items: [],
          },
        ],
        {},
        { defaultExpandedRowId: "turn:2" },
      ),
    ).toEqual({
      "turn:1": true,
      "summary:1": true,
      "turn:2": false,
    });
  });

  it("preserves existing collapse state for retained rows while pruning removed rows", () => {
    expect(
      reconcileCollapsedRowIds(
        [
          {
            kind: "turn",
            id: "turn:1",
            userMessage: { id: "u1", role: "user", content: [""] },
            items: [],
          },
          {
            kind: "turn",
            id: "turn:2",
            userMessage: { id: "u2", role: "user", content: [""] },
            items: [],
          },
          {
            kind: "summary",
            id: "summary:3",
            message: { id: "s3", role: "compactionSummary", content: [""] },
          },
        ],
        {
          "turn:1": false,
          "turn:2": true,
          removed: false,
        },
        { defaultExpandedRowId: "turn:2" },
      ),
    ).toEqual({
      "turn:1": false,
      "turn:2": true,
      "summary:3": true,
    });
  });

  it("forces the streaming turn open until streaming ends", () => {
    expect(
      reconcileCollapsedRowIds(
        [
          {
            kind: "turn",
            id: "turn:1",
            userMessage: { id: "u1", role: "user", content: [""] },
            items: [],
          },
          {
            kind: "turn",
            id: "turn:2",
            userMessage: { id: "u2", role: "user", content: [""] },
            items: [],
          },
        ],
        {
          "turn:1": true,
          "turn:2": true,
        },
        { defaultExpandedRowId: "turn:2", forcedExpandedRowId: "turn:2" },
      ),
    ).toEqual({
      "turn:1": true,
      "turn:2": false,
    });
  });
});
