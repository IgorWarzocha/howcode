import { describe, expect, it } from "vitest";
import {
  getFirstUserTurnTitle,
  getPreviousMessageCount,
  mapAgentMessagesToUiMessages,
  normalizeThreadTitle,
} from "../../shared/pi-message-mapper";

describe("pi message mapper", () => {
  it("normalizes titles and derives the first user title", () => {
    expect(normalizeThreadTitle("")).toBe("New thread");
    expect(normalizeThreadTitle("   hello\n\nworld   ")).toBe("hello world");
    expect(normalizeThreadTitle("x".repeat(80))).toBe(`${"x".repeat(69)}...`);

    const messages = mapAgentMessagesToUiMessages([
      { role: "assistant", timestamp: 1, content: [{ type: "text", text: "Preface" }] },
      { role: "user", timestamp: 2, content: [{ type: "text", text: "Fix the sidebar" }] },
    ] as never[]);
    expect(getFirstUserTurnTitle(messages)).toBe("Fix the sidebar");
  });

  it("maps mixed runtime messages into desktop messages", () => {
    const messages = mapAgentMessagesToUiMessages([
      {
        role: "user",
        timestamp: 1,
        content: [
          { type: "text", text: "Investigate this bug" },
          { type: "image", mimeType: "image/png" },
        ],
      },
      {
        role: "assistant",
        timestamp: 2,
        content: [
          { type: "thinking", thinking: "Need to inspect the state flow first" },
          { type: "text", text: "First paragraph\n\nSecond paragraph" },
        ],
      },
      {
        role: "toolResult",
        timestamp: 3,
        toolName: "grep",
        isError: false,
        content: [{ type: "text", text: "Found 2 matches" }],
      },
      {
        role: "bashExecution",
        timestamp: 4,
        command: "npm test",
        output: "line1\n\nline2",
        exitCode: 0,
      },
      {
        role: "branchSummary",
        timestamp: 5,
        summary: "Kept the main branch summary",
      },
    ] as never[]);

    expect(messages).toEqual([
      {
        id: "1-user",
        role: "user",
        content: ["Investigate this bug", "Attached image 1"],
      },
      {
        id: "2-assistant",
        role: "assistant",
        content: ["First paragraph", "Second paragraph"],
        thinkingContent: ["Need to inspect the state flow first"],
      },
      {
        id: "3-toolResult",
        role: "toolResult",
        toolName: "grep",
        content: ["Found 2 matches"],
        isError: false,
      },
      {
        id: "4-bashExecution",
        role: "bashExecution",
        command: "npm test",
        output: ["line1", "line2"],
        exitCode: 0,
        cancelled: false,
        truncated: false,
      },
      {
        id: "5-branchSummary",
        role: "branchSummary",
        content: ["Kept the main branch summary"],
      },
    ]);
  });

  it("preserves tool result images for desktop rendering", () => {
    expect(
      mapAgentMessagesToUiMessages([
        {
          role: "toolResult",
          timestamp: 1,
          toolName: "custom_image_tool",
          isError: false,
          content: [
            { type: "text", text: "Generated image" },
            { type: "image", data: "iVBORw0KGgo=", mimeType: "image/png" },
          ],
        },
      ] as never[]),
    ).toEqual([
      {
        id: "1-toolResult",
        role: "toolResult",
        toolName: "custom_image_tool",
        content: ["Generated image", "Attached image 1"],
        images: [
          {
            src: "data:image/png;base64,iVBORw0KGgo=",
            mimeType: "image/png",
            alt: "Tool result image 2",
          },
        ],
        isError: false,
      },
    ]);
  });

  it("preserves thinking-only messages and extracts thinking headers", () => {
    expect(
      mapAgentMessagesToUiMessages([
        {
          role: "assistant",
          timestamp: 1,
          content: [{ type: "thinking", thinking: "Working through the repo structure" }],
        },
      ] as never[]),
    ).toEqual([
      {
        id: "1-assistant",
        role: "assistant",
        content: [],
        thinkingContent: ["Working through the repo structure"],
      },
    ]);

    expect(
      mapAgentMessagesToUiMessages([
        {
          role: "assistant",
          timestamp: 1,
          content: [
            {
              type: "thinking",
              thinking:
                "**Optimizing Markdown Formatting**\n\nBody\n\n## Formatting thoughts and styles\n\nMore body\n\n__Considering markdown in thinking blocks__\n\nLast body",
            },
          ],
        },
      ] as never[]),
    ).toEqual([
      {
        id: "1-assistant",
        role: "assistant",
        content: [],
        thinkingContent: [
          "**Optimizing Markdown Formatting**",
          "Body",
          "## Formatting thoughts and styles",
          "More body",
          "__Considering markdown in thinking blocks__",
          "Last body",
        ],
        thinkingHeaders: [
          "Optimizing Markdown Formatting",
          "Formatting thoughts and styles",
          "Considering markdown in thinking blocks",
        ],
      },
    ]);
  });

  it("counts previous messages from the latest compaction boundary", () => {
    expect(
      getPreviousMessageCount([
        { type: "message", id: "m1" },
        { type: "custom_message", id: "m2" },
        { type: "branch_summary", id: "m3" },
        { type: "message", id: "keep" },
        { type: "compaction", id: "c1", firstKeptEntryId: "keep" },
        { type: "message", id: "m4" },
      ]),
    ).toBe(3);
  });
});
