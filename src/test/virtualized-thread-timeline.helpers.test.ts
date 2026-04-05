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

describe("virtualized thread timeline helpers", () => {
  it("keeps the streaming turn in the unvirtualized tail", () => {
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
    expect(result.effectiveCollapsedRowIds["turn-2"]).toBe(false);
  });
});
