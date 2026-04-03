import { describe, expect, it } from "vitest";
import {
  getCollapsibleRowKey,
  getRowStructureSignature,
  getStreamingAssistantMessageId,
} from "../app/components/workspace/thread/thread-timeline-signatures";
import type { TimelineRow } from "../app/components/workspace/thread/timeline-row";

describe("thread timeline signatures", () => {
  it("finds the latest streaming assistant message id", () => {
    expect(
      getStreamingAssistantMessageId(
        [
          { id: "user-1", role: "user", content: ["hi"] },
          { id: "assistant-1", role: "assistant", content: ["one"] },
          { id: "assistant-2", role: "assistant", content: ["two"] },
        ],
        true,
      ),
    ).toBe("assistant-2");
  });

  it("builds stable row keys and row structure signatures", () => {
    const turnRow: Extract<TimelineRow, { kind: "turn" }> = {
      kind: "turn",
      id: "turn-1",
      userMessage: { id: "user-1", role: "user", content: ["hi"] },
      items: [],
    };
    const rows: TimelineRow[] = [
      { kind: "history-divider", id: "history", hiddenCount: 3 },
      turnRow,
    ];
    const collapsedRowIds = { "turn-1": true };

    expect(getCollapsibleRowKey(turnRow, collapsedRowIds)).toBe("turn-1:collapsed");
    expect(getRowStructureSignature(rows, collapsedRowIds)).toBe("history:3||turn-1:collapsed:0");
  });
});
