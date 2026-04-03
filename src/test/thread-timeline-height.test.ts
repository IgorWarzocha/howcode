import { describe, expect, it } from "vitest";
import { estimateThreadTimelineRowHeight } from "../app/components/workspace/thread/estimateThreadTimelineRowHeight";
import type { TimelineRow } from "../app/components/workspace/thread/timeline-row";

describe("estimateThreadTimelineRowHeight", () => {
  it("keeps collapsed summaries compact and turn rows larger than history dividers", () => {
    const historyRow: TimelineRow = {
      kind: "history-divider",
      id: "history:1",
      hiddenCount: 10,
    };
    const summaryRow: TimelineRow = {
      kind: "summary",
      id: "summary:1",
      message: {
        id: "summary-message",
        role: "branchSummary",
        content: ["Summarized changes"],
      },
    };
    const turnRow: TimelineRow = {
      kind: "turn",
      id: "turn:1",
      userMessage: { id: "user-1", role: "user", content: ["Please fix the chat"] },
      items: [
        {
          kind: "message",
          id: "assistant-1",
          message: {
            id: "assistant-1",
            role: "assistant",
            content: ["I split the timeline into smaller files."],
          },
        },
      ],
    };

    expect(estimateThreadTimelineRowHeight(historyRow)).toBe(40);
    expect(estimateThreadTimelineRowHeight(summaryRow, { collapsed: true })).toBe(56);
    expect(estimateThreadTimelineRowHeight(turnRow)).toBeGreaterThan(
      estimateThreadTimelineRowHeight(historyRow),
    );
  });
});
