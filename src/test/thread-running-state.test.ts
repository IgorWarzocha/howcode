import { describe, expect, it } from "vitest";
import type { InboxThread } from "../../shared/desktop-contracts";
import {
  getEffectiveThreadRunningState,
  sortInboxThreadsByPriority,
} from "../../shared/thread-running-state";

describe("thread running state", () => {
  it("uses the live runtime state when available", () => {
    expect(getEffectiveThreadRunningState(false, { isStreaming: true })).toBe(true);
    expect(getEffectiveThreadRunningState(true, { isStreaming: false })).toBe(false);
  });

  it("falls back to the persisted state when no live runtime state is known", () => {
    expect(getEffectiveThreadRunningState(true, null)).toBe(true);
    expect(getEffectiveThreadRunningState(false, null)).toBe(false);
  });

  it("sorts inbox threads by unread, effective running state, then activity", () => {
    const threads: InboxThread[] = [
      {
        threadId: "idle-newer",
        title: "Idle newer",
        projectId: "/tmp/project",
        projectName: "project",
        sessionPath: "/tmp/idle-newer",
        age: "1m",
        lastActivityMs: 200,
        prompt: null,
        content: [],
        preview: null,
        running: false,
        unread: false,
      },
      {
        threadId: "running",
        title: "Running",
        projectId: "/tmp/project",
        projectName: "project",
        sessionPath: "/tmp/running",
        age: "2m",
        lastActivityMs: 100,
        prompt: null,
        content: [],
        preview: null,
        running: true,
        unread: false,
      },
      {
        threadId: "unread",
        title: "Unread",
        projectId: "/tmp/project",
        projectName: "project",
        sessionPath: "/tmp/unread",
        age: "3m",
        lastActivityMs: 50,
        prompt: null,
        content: [],
        preview: null,
        running: false,
        unread: true,
      },
    ];

    expect(sortInboxThreadsByPriority(threads).map((thread) => thread.threadId)).toEqual([
      "unread",
      "running",
      "idle-newer",
    ]);
  });
});
