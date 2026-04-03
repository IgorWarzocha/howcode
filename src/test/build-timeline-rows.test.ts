import { describe, expect, it } from "vitest";
import { buildTimelineRows } from "../app/components/workspace/thread/buildTimelineRows";
import type { Message, TurnDiffSummary } from "../app/types";

describe("buildTimelineRows", () => {
  it("groups tool calls into turns and keeps summaries separate", () => {
    const messages: Message[] = [
      { id: "user-1", role: "user", content: ["Investigate the chat window"] },
      {
        id: "tool-1",
        role: "toolResult",
        toolName: "rg",
        content: ["Found 3 files"],
        isError: false,
      },
      {
        id: "assistant-1",
        role: "assistant",
        content: ["I found the main rendering path."],
      },
      {
        id: "summary-1",
        role: "branchSummary",
        content: ["Kept the timeline split plan."],
      },
    ];
    const turnDiffSummaries: TurnDiffSummary[] = [
      {
        checkpointTurnCount: 2,
        checkpointRef: "ref-2",
        status: "ready",
        files: [{ path: "src/app/chat.tsx", kind: "modified", additions: 3, deletions: 1 }],
        assistantMessageId: "assistant-1",
        completedAt: new Date(0).toISOString(),
      },
    ];

    expect(buildTimelineRows({ messages, previousMessageCount: 4, turnDiffSummaries })).toEqual([
      { kind: "history-divider", id: "history-divider:4", hiddenCount: 4 },
      {
        kind: "turn",
        id: "turn:user-1",
        userMessage: messages[0],
        items: [
          {
            kind: "tool-group",
            id: "tool-group:tool-1:tool-1:1",
            messages: [messages[1]],
          },
          {
            kind: "message",
            id: "assistant-1",
            message: messages[2],
            turnSummary: turnDiffSummaries[0],
          },
        ],
      },
      {
        kind: "summary",
        id: "summary:summary-1",
        message: messages[3],
      },
    ]);
  });

  it("starts a new foldable turn after a compaction summary", () => {
    const messages: Message[] = [
      { id: "user-1", role: "user", content: ["Investigate the chat window"] },
      {
        id: "assistant-1",
        role: "assistant",
        content: ["I found the rendering path."],
      },
      {
        id: "summary-1",
        role: "compactionSummary",
        content: ["Compacted earlier context."],
      },
      {
        id: "tool-2",
        role: "toolResult",
        toolName: "rg",
        content: ["Found the timeline builder"],
        isError: false,
      },
      {
        id: "assistant-2",
        role: "assistant",
        content: ["I can now patch the grouping logic."],
      },
    ];

    expect(buildTimelineRows({ messages, previousMessageCount: 0, turnDiffSummaries: [] })).toEqual(
      [
        {
          kind: "turn",
          id: "turn:user-1",
          userMessage: messages[0],
          items: [
            {
              kind: "message",
              id: "assistant-1",
              message: messages[1],
              turnSummary: undefined,
            },
          ],
        },
        {
          kind: "summary",
          id: "summary:summary-1",
          message: messages[2],
        },
        {
          kind: "turn",
          id: "turn:post-summary:summary-1",
          userMessage: null,
          items: [
            {
              kind: "tool-group",
              id: "tool-group:tool-2:tool-2:1",
              messages: [messages[3]],
            },
            {
              kind: "message",
              id: "assistant-2",
              message: messages[4],
              turnSummary: undefined,
            },
          ],
        },
      ],
    );
  });
});
