import { describe, expect, it } from "vitest";
import type { ProseMessage } from "../../shared/desktop-contracts";
import { buildThreadTimelineState } from "../app/components/workspace/thread/thread-timeline-state";
import type { TimelineRow } from "../app/components/workspace/thread/timeline-row";

const userMessage: ProseMessage = {
  id: "user-1",
  role: "user",
  content: ["hello"],
};

const streamingAssistantMessage: ProseMessage = {
  id: "assistant-1",
  role: "assistant",
  content: ["working"],
};

const rows: TimelineRow[] = [
  {
    kind: "turn",
    id: "turn-1",
    userMessage,
    items: [
      {
        kind: "message",
        id: "row-user-1",
        message: userMessage,
      },
    ],
  },
  {
    kind: "turn",
    id: "turn-2",
    userMessage,
    items: [
      {
        kind: "message",
        id: "row-assistant-1",
        message: streamingAssistantMessage,
      },
    ],
  },
];

const summaryRows: TimelineRow[] = [
  rows[0] as TimelineRow,
  {
    kind: "summary",
    id: "summary-1",
    message: {
      id: "summary-message-1",
      role: "compactionSummary",
      content: ["Large summary"],
    },
  },
  rows[1] as TimelineRow,
];

describe("thread timeline state", () => {
  it("keeps thread rows out of the virtualized region", () => {
    const result = buildThreadTimelineState({
      rows,
      messages: [userMessage, streamingAssistantMessage],
      isStreaming: true,
      collapsedRowIds: {},
      expandedToolGroupIds: {},
      expandedDiffTrees: {},
    });

    expect(result.streamingTurnRowId).toBe("turn-2");
    expect(result.virtualizedRowCount).toBe(0);
    expect(result.firstUnvirtualizedRowIndex).toBe(0);
    expect(result.effectiveCollapsedRowIds["turn-2"]).toBe(false);
  });

  it("keeps expanded summaries in normal document flow", () => {
    const result = buildThreadTimelineState({
      rows: summaryRows,
      messages: [userMessage],
      isStreaming: false,
      collapsedRowIds: {
        "turn-1": true,
        "summary-1": false,
        "turn-2": false,
      },
      expandedToolGroupIds: {},
      expandedDiffTrees: {},
    });

    expect(result.effectiveCollapsedRowIds["summary-1"]).toBe(false);
    expect(result.virtualizedRowCount).toBe(0);
    expect(result.firstUnvirtualizedRowIndex).toBe(0);
  });
});
