import { describe, expect, it } from "vitest";
import type { ThreadData } from "../../shared/desktop-contracts";
import { setThreadStreamingState } from "../../shared/thread-data";

function buildThreadData(isStreaming: boolean): ThreadData {
  return {
    sessionPath: "/tmp/thread.jsonl",
    title: "Thread",
    messages: [],
    previousMessageCount: 0,
    isStreaming,
  };
}

describe("setThreadStreamingState", () => {
  it("can force a stale streaming snapshot idle", () => {
    expect(setThreadStreamingState(buildThreadData(true), false).isStreaming).toBe(false);
  });

  it("preserves identity when the requested state already matches", () => {
    const thread = buildThreadData(false);
    expect(setThreadStreamingState(thread, false)).toBe(thread);
  });

  it("can opt back into streaming when needed", () => {
    expect(setThreadStreamingState(buildThreadData(false), true).isStreaming).toBe(true);
  });
});
