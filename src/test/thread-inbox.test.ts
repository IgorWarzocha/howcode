import { describe, expect, it } from "vitest";
import { getLatestInboxAssistantMessage } from "../../shared/thread-inbox";
import type { Message } from "../app/types";

describe("thread inbox", () => {
  it("stores the latest final assistant reply from the current turn", () => {
    const messages: Message[] = [
      { id: "user-1", role: "user", content: ["First prompt"] },
      { id: "assistant-1", role: "assistant", content: ["First reply"] },
      { id: "user-2", role: "user", content: ["Second prompt"] },
      {
        id: "assistant-2",
        role: "assistant",
        content: ["Second reply", "More detail"],
      },
    ];

    expect(getLatestInboxAssistantMessage(messages)).toEqual({
      content: ["Second reply", "More detail"],
      preview: "Second reply",
    });
  });

  it("ignores thinking-only assistant updates for the current turn", () => {
    const messages: Message[] = [
      { id: "user-1", role: "user", content: ["First prompt"] },
      { id: "assistant-1", role: "assistant", content: ["First reply"] },
      { id: "user-2", role: "user", content: ["Second prompt"] },
      {
        id: "assistant-2",
        role: "assistant",
        content: [],
        thinkingContent: ["Working through the plan"],
      },
    ];

    expect(getLatestInboxAssistantMessage(messages)).toBeNull();
  });

  it("does not fall back to the previous turn's reply when the current turn has no final answer", () => {
    const messages: Message[] = [
      { id: "user-1", role: "user", content: ["First prompt"] },
      { id: "assistant-1", role: "assistant", content: ["First reply"] },
      { id: "user-2", role: "user", content: ["Second prompt"] },
      { id: "tool-1", role: "toolResult", toolName: "rg", content: ["match"], isError: false },
    ];

    expect(getLatestInboxAssistantMessage(messages)).toBeNull();
  });

  it("ignores assistant messages that are followed by tool work in the same turn", () => {
    const messages: Message[] = [
      { id: "user-1", role: "user", content: ["Inspect the config"] },
      { id: "assistant-1", role: "assistant", content: ["I'll check the file."] },
      { id: "tool-1", role: "toolResult", toolName: "read", content: ["{}"], isError: false },
    ];

    expect(getLatestInboxAssistantMessage(messages)).toBeNull();
  });
});
