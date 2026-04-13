import { describe, expect, it } from "vitest";
import { isScrollContainerNearBottom } from "../app/components/workspace/thread/chat-scroll";
import {
  getCollapsedTurnPreview,
  getMessagePreview,
} from "../app/components/workspace/thread/thread-timeline-previews";

describe("thread timeline previews", () => {
  it("formats previews for assistant, tool, and shell messages", () => {
    expect(
      getMessagePreview({
        id: "assistant-1",
        role: "assistant",
        content: ["Visible reply"],
        thinkingHeaders: ["Planning", "Patch"],
      }),
    ).toBe("Planning, Patch");

    expect(
      getMessagePreview({
        id: "tool-1",
        role: "toolResult",
        toolName: "rg",
        content: ["Found matches"],
        isError: false,
      }),
    ).toBe("rg — Found matches");

    expect(
      getMessagePreview({
        id: "bash-1",
        role: "bashExecution",
        command: "bun test",
        output: [],
        exitCode: 0,
        cancelled: false,
        truncated: false,
      }),
    ).toBe("$ bun test");
  });

  it("builds collapsed previews for user, continued, tool-only, and assistant-only turns", () => {
    expect(
      getCollapsedTurnPreview({
        kind: "turn",
        id: "turn:user",
        userMessage: { id: "user-1", role: "user", content: ["Fix the timeline"] },
        items: [
          {
            kind: "message",
            id: "assistant-1",
            message: { id: "assistant-1", role: "assistant", content: ["Done"] },
          },
        ],
      }),
    ).toEqual({
      label: "Fix the timeline",
      secondary: "Done",
      italicLabel: false,
    });

    expect(
      getCollapsedTurnPreview({
        kind: "turn",
        id: "turn:continued",
        userMessage: null,
        items: [],
      }),
    ).toEqual({
      label: "Continued turn",
      secondary: null,
      italicLabel: false,
    });

    expect(
      getCollapsedTurnPreview({
        kind: "turn",
        id: "turn:tool",
        userMessage: null,
        items: [
          {
            kind: "tool-group",
            id: "tool-group-1",
            messages: [
              {
                id: "tool-1",
                role: "toolResult",
                toolName: "rg",
                content: ["Found src/app.ts"],
                isError: false,
              },
            ],
          },
        ],
      }),
    ).toEqual({
      label: "rg — Found src/app.ts",
      secondary: null,
      italicLabel: false,
    });

    expect(
      getCollapsedTurnPreview({
        kind: "turn",
        id: "turn:assistant",
        userMessage: null,
        items: [
          {
            kind: "message",
            id: "assistant-2",
            message: { id: "assistant-2", role: "assistant", content: ["Patch ready"] },
          },
        ],
      }),
    ).toEqual({
      label: "Patch ready",
      secondary: null,
      italicLabel: true,
    });
  });
});

describe("chat scroll", () => {
  it("treats negative thresholds as zero", () => {
    expect(
      isScrollContainerNearBottom(
        {
          scrollTop: 99,
          clientHeight: 100,
          scrollHeight: 200,
        },
        -5,
      ),
    ).toBe(false);
  });

  it("treats non-finite positions as near the bottom", () => {
    expect(
      isScrollContainerNearBottom({
        scrollTop: Number.NaN,
        clientHeight: 100,
        scrollHeight: 200,
      }),
    ).toBe(true);
  });
});
