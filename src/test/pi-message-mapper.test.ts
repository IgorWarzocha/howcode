import { describe, expect, it } from "vitest";
import {
  getFirstUserTurnTitle,
  getPreviousMessageCount,
  mapAgentMessagesToUiMessages,
  normalizeThreadTitle,
} from "../../shared/pi-message-mapper";

describe("pi message mapper", () => {
  it("normalizes empty and long thread titles", () => {
    expect(normalizeThreadTitle("")).toBe("New thread");
    expect(normalizeThreadTitle("   hello\n\nworld   ")).toBe("hello world");
    expect(normalizeThreadTitle("x".repeat(80))).toBe(`${"x".repeat(69)}...`);
  });

  it("maps mixed Pi messages into desktop messages", () => {
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
        id: "1-user-0",
        role: "user",
        content: ["Investigate this bug", "Attached image 1"],
      },
      {
        id: "2-assistant-1",
        role: "assistant",
        content: ["First paragraph", "Second paragraph"],
        thinkingContent: ["Need to inspect the state flow first"],
      },
      {
        id: "3-toolResult-2",
        role: "toolResult",
        toolName: "grep",
        content: ["Found 2 matches"],
        isError: false,
      },
      {
        id: "4-bashExecution-3",
        role: "bashExecution",
        command: "npm test",
        output: ["line1", "line2"],
        exitCode: 0,
        cancelled: false,
        truncated: false,
      },
      {
        id: "5-branchSummary-4",
        role: "branchSummary",
        content: ["Kept the main branch summary"],
      },
    ]);
  });

  it("derives a title from the first user turn", () => {
    const messages = mapAgentMessagesToUiMessages([
      { role: "assistant", timestamp: 1, content: [{ type: "text", text: "Preface" }] },
      { role: "user", timestamp: 2, content: [{ type: "text", text: "Fix the sidebar" }] },
    ] as never[]);

    expect(getFirstUserTurnTitle(messages)).toBe("Fix the sidebar");
  });

  it("keeps thinking-only assistant messages visible", () => {
    const messages = mapAgentMessagesToUiMessages([
      {
        role: "assistant",
        timestamp: 1,
        content: [{ type: "thinking", thinking: "Working through the repo structure" }],
      },
    ] as never[]);

    expect(messages).toEqual([
      {
        id: "1-assistant-0",
        role: "assistant",
        content: [],
        thinkingContent: ["Working through the repo structure"],
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
