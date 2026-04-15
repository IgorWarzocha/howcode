import { describe, expect, it } from "vitest";
import { buildThreadData } from "../../shared/thread-data";

describe("buildThreadData", () => {
  it("normalizes runtime messages into a chat-window thread snapshot", () => {
    expect(
      buildThreadData({
        sessionPath: "/tmp/thread.json",
        previousMessageCount: 2,
        isStreaming: true,
        sourceMessages: [
          { role: "user", timestamp: 1, content: [{ type: "text", text: "Fix the timeline" }] },
          {
            role: "assistant",
            timestamp: 2,
            content: [{ type: "text", text: "Split the timeline into smaller modules." }],
          },
        ] as never[],
      }),
    ).toEqual({
      sessionPath: "/tmp/thread.json",
      title: "Fix the timeline",
      messages: [
        {
          id: "1-user",
          role: "user",
          content: ["Fix the timeline"],
        },
        {
          id: "2-assistant",
          role: "assistant",
          content: ["Split the timeline into smaller modules."],
        },
      ],
      previousMessageCount: 2,
      isStreaming: true,
    });
  });
});
