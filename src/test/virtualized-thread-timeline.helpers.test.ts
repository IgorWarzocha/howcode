import { describe, expect, it } from "vitest";
import type { ProseMessage } from "../../shared/desktop-contracts";
import type { TimelineRow } from "../app/components/workspace/thread/timeline-row";
import { buildVirtualizedThreadTimelineState } from "../app/components/workspace/thread/virtualized-thread-timeline.helpers";
import type { Message } from "../app/types";

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
    kind: "summary",
    id: "summary-1",
    message: {
      id: "summary-message-1",
      role: "compactionSummary",
      content: ["Large summary"],
    },
  },
  {
    kind: "turn",
    id: "turn-2",
    userMessage,
    items: [
      {
        kind: "message",
        id: "row-user-2",
        message: userMessage,
      },
    ],
  },
  {
    kind: "turn",
    id: "turn-3",
    userMessage,
    items: [
      {
        kind: "message",
        id: "row-user-3",
        message: userMessage,
      },
    ],
  },
  {
    kind: "turn",
    id: "turn-4",
    userMessage,
    items: [
      {
        kind: "message",
        id: "row-user-4",
        message: userMessage,
      },
    ],
  },
  {
    kind: "turn",
    id: "turn-5",
    userMessage,
    items: [
      {
        kind: "message",
        id: "row-user-5",
        message: userMessage,
      },
    ],
  },
  {
    kind: "turn",
    id: "turn-6",
    userMessage,
    items: [
      {
        kind: "message",
        id: "row-user-6",
        message: userMessage,
      },
    ],
  },
  {
    kind: "turn",
    id: "turn-7",
    userMessage,
    items: [
      {
        kind: "message",
        id: "row-user-7",
        message: userMessage,
      },
    ],
  },
  {
    kind: "turn",
    id: "turn-8",
    userMessage,
    items: [
      {
        kind: "message",
        id: "row-user-8",
        message: userMessage,
      },
    ],
  },
  {
    kind: "turn",
    id: "turn-9",
    userMessage,
    items: [
      {
        kind: "message",
        id: "row-user-9",
        message: userMessage,
      },
    ],
  },
];

describe("virtualized thread timeline helpers", () => {
  it("keeps thread rows out of the virtualized region", () => {
    const result = buildVirtualizedThreadTimelineState({
      rows,
      messages: [userMessage, streamingAssistantMessage],
      isStreaming: true,
      collapsedRowIds: {},
      expandedToolGroupIds: {},
      expandedDiffTrees: {},
      timelineWidthPx: 744,
    });

    expect(result.streamingTurnRowId).toBe("turn-2");
    expect(result.virtualizedRowCount).toBe(0);
    expect(result.firstUnvirtualizedRowIndex).toBe(0);
    expect(result.effectiveCollapsedRowIds["turn-2"]).toBe(false);
  });

  it("still keeps expanded summaries in normal document flow", () => {
    const result = buildVirtualizedThreadTimelineState({
      rows: summaryRows,
      messages: [userMessage],
      isStreaming: false,
      collapsedRowIds: {
        "turn-1": true,
        "summary-1": false,
        "turn-2": true,
        "turn-3": true,
        "turn-4": true,
        "turn-5": true,
        "turn-6": true,
        "turn-7": true,
        "turn-8": true,
        "turn-9": false,
      },
      expandedToolGroupIds: {},
      expandedDiffTrees: {},
      timelineWidthPx: 744,
    });

    expect(result.effectiveCollapsedRowIds["summary-1"]).toBe(false);
    expect(result.virtualizedRowCount).toBe(0);
    expect(result.firstUnvirtualizedRowIndex).toBe(0);
  });
});
