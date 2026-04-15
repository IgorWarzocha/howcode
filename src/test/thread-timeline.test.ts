import { describe, expect, it } from "vitest";
import type { ProseMessage } from "../../shared/desktop-contracts";
import { buildTimelineRows } from "../app/components/workspace/thread/buildTimelineRows";
import { reconcileCollapsedRowIds } from "../app/components/workspace/thread/reconcileCollapsedRowIds";
import {
  getCollapsibleRowKey,
  getFoldableRows,
} from "../app/components/workspace/thread/thread-timeline-signatures";
import { buildThreadTimelineState } from "../app/components/workspace/thread/thread-timeline-state";
import type { TimelineRow } from "../app/components/workspace/thread/timeline-row";
import { isTurnRowCollapsible } from "../app/components/workspace/thread/timeline-row";
import type { Message } from "../app/types";

describe("thread timeline", () => {
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
    expect(buildTimelineRows({ messages, previousMessageCount: 4 })).toEqual([
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

  it("starts a new implicit turn after a compaction summary", () => {
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

    expect(buildTimelineRows({ messages, previousMessageCount: 0 })).toEqual([
      {
        kind: "turn",
        id: "turn:user-1",
        userMessage: messages[0],
        items: [
          {
            kind: "message",
            id: "assistant-1",
            message: messages[1],
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
          },
        ],
      },
    ]);
  });

  it("derives streaming state, signatures, and virtualized row markers from timeline rows", () => {
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
            id: "row-assistant-1",
            message: streamingAssistantMessage,
          },
        ],
      },
    ];

    const result = buildThreadTimelineState({
      rows,
      messages: [userMessage, streamingAssistantMessage],
      isStreaming: true,
      collapsedRowIds: {
        "turn-1": true,
        "summary-1": false,
        "turn-2": true,
      },
      expandedToolGroupIds: {},
    });

    expect(result.streamingAssistantMessageId).toBe("assistant-1");
    expect(result.streamingTurnRowId).toBe("turn-2");
    expect(result.effectiveCollapsedRowIds).toEqual({
      "turn-1": true,
      "summary-1": false,
      "turn-2": false,
    });
    expect(result.rowStructureSignature).toBe(
      "turn-1:collapsed:1||summary-1:expanded||turn-2:expanded:1",
    );
    expect(result.virtualizedRowCount).toBe(0);
    expect(result.firstUnvirtualizedRowIndex).toBe(0);
  });

  it("tracks the active streaming tool group when a tool call is the latest message", () => {
    const messages: Message[] = [
      { id: "user-1", role: "user", content: ["hi"] },
      {
        id: "tool-1",
        role: "bashExecution",
        command: "rg foo",
        output: [],
        exitCode: 0,
        cancelled: false,
        truncated: false,
      },
      {
        id: "tool-2",
        role: "toolResult",
        toolName: "rg",
        content: ["match"],
        isError: false,
      },
    ];
    const rows = buildTimelineRows({ messages, previousMessageCount: 0 });
    const result = buildThreadTimelineState({
      rows,
      messages,
      isStreaming: true,
      collapsedRowIds: {},
      expandedToolGroupIds: {},
    });

    expect(result.streamingToolGroupId).toBe("tool-group:tool-1:tool-2:2");
  });

  it("reconciles collapse state by pruning removed rows, defaulting new rows closed, and forcing streaming rows open", () => {
    const foldableRows = getFoldableRows([
      {
        kind: "turn",
        id: "turn:1",
        userMessage: { id: "u1", role: "user", content: [""] },
        items: [
          { kind: "message", id: "a1", message: { id: "a1", role: "assistant", content: [""] } },
        ],
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
        items: [
          { kind: "message", id: "a2", message: { id: "a2", role: "assistant", content: [""] } },
        ],
      },
    ]);

    const nextCollapsedRowIds = reconcileCollapsedRowIds(
      foldableRows,
      {
        "turn:1": false,
        "turn:2": true,
        removed: false,
      },
      { defaultExpandedRowId: "turn:2", forcedExpandedRowId: "turn:2" },
    );

    expect(nextCollapsedRowIds).toEqual({
      "turn:1": false,
      "summary:1": true,
      "turn:2": false,
    });
    expect(getCollapsibleRowKey(foldableRows[1] as TimelineRow, nextCollapsedRowIds)).toBe(
      "summary:1:collapsed",
    );
  });

  it("only marks turns collapsible when collapsing would actually hide content", () => {
    expect(
      isTurnRowCollapsible({
        kind: "turn",
        id: "turn:user",
        userMessage: { id: "u1", role: "user", content: [""] },
        items: [],
      }),
    ).toBe(false);

    expect(
      isTurnRowCollapsible({
        kind: "turn",
        id: "turn:assistant-only",
        userMessage: null,
        items: [
          {
            kind: "message",
            id: "a1",
            message: { id: "a1", role: "assistant", content: ["Only prose"] },
          },
        ],
      }),
    ).toBe(false);

    expect(
      isTurnRowCollapsible({
        kind: "turn",
        id: "turn:assistant-thinking",
        userMessage: null,
        items: [
          {
            kind: "message",
            id: "a2",
            message: {
              id: "a2",
              role: "assistant",
              content: ["Visible reply"],
              thinkingContent: ["Hidden thinking"],
            },
          },
        ],
      }),
    ).toBe(true);
  });
});
