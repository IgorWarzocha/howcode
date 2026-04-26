import { describe, expect, it } from "vitest";
import { type SessionPathEntry, buildThreadHistorySlice } from "../../shared/thread-history";

function messageEntry(
  id: string,
  timestamp: number,
  role: "user" | "assistant",
  text: string,
): SessionPathEntry {
  return {
    type: "message",
    id,
    message: {
      role,
      timestamp,
      content: [{ type: "text", text }],
    } as never,
  };
}

describe("buildThreadHistorySlice", () => {
  const pathEntries: SessionPathEntry[] = [
    messageEntry("u1", 1, "user", "u1"),
    messageEntry("a1", 2, "assistant", "a1"),
    messageEntry("u2", 3, "user", "u2"),
    messageEntry("a2", 4, "assistant", "a2"),
    {
      type: "compaction",
      id: "c1",
      summary: "summary 1",
      firstKeptEntryId: "u2",
      timestamp: 5,
      tokensBefore: 100,
    },
    messageEntry("u3", 6, "user", "u3"),
    messageEntry("a3", 7, "assistant", "a3"),
    {
      type: "compaction",
      id: "c2",
      summary: "summary 2",
      firstKeptEntryId: "u3",
      timestamp: 8,
      tokensBefore: 200,
    },
    messageEntry("u4", 9, "user", "u4"),
    messageEntry("a4", 10, "assistant", "a4"),
  ];

  it("matches latest compaction window by default", () => {
    const slice = buildThreadHistorySlice(pathEntries, 0);

    expect(slice.previousMessageCount).toBe(4);
    expect(slice.sourceMessages.map((message) => `${message.timestamp}:${message.role}`)).toEqual([
      "6:user",
      "7:assistant",
      "8:compactionSummary",
      "9:user",
      "10:assistant",
    ]);
  });

  it("reveals one earlier compaction boundary at a time", () => {
    const slice = buildThreadHistorySlice(pathEntries, 1);

    expect(slice.previousMessageCount).toBe(2);
    expect(slice.sourceMessages.map((message) => `${message.timestamp}:${message.role}`)).toEqual([
      "3:user",
      "4:assistant",
      "5:compactionSummary",
      "6:user",
      "7:assistant",
      "8:compactionSummary",
      "9:user",
      "10:assistant",
    ]);
  });

  it("falls back to full history after all compactions are revealed", () => {
    const slice = buildThreadHistorySlice(pathEntries, 2);

    expect(slice.previousMessageCount).toBe(0);
    expect(slice.sourceMessages.map((message) => `${message.timestamp}:${message.role}`)).toEqual([
      "1:user",
      "2:assistant",
      "3:user",
      "4:assistant",
      "5:compactionSummary",
      "6:user",
      "7:assistant",
      "8:compactionSummary",
      "9:user",
      "10:assistant",
    ]);
  });
});
