import { describe, expect, it, vi } from "vitest";
import { submitComposerDraft } from "../app/components/workspace/composer/submitComposerDraft";
import type { DesktopActionResult } from "../app/desktop/types";

function buildActionFailureResult(action: "composer.send" | "composer.stop", error: string) {
  return {
    ok: false,
    at: new Date().toISOString(),
    payload: {
      action,
      payload: {},
    },
    result: {
      error,
    },
  } satisfies DesktopActionResult;
}

function buildActionSuccessResult(outcome: "sent" | "stopped" = "sent") {
  return {
    ok: true,
    at: new Date().toISOString(),
    payload: {
      action: "composer.send",
      payload: {},
    },
    result: {
      composerSendOutcome: outcome,
    },
  } satisfies DesktopActionResult;
}

describe("submitComposerDraft", () => {
  it("sends a draft successfully", async () => {
    const onAction = vi.fn(async () => buildActionSuccessResult());
    const result = await submitComposerDraft({
      draft: "  ship it  ",
      attachments: [{ path: "/repo/file.ts", name: "file.ts", kind: "text" }],
      isSending: false,
      projectId: "/repo",
      sessionPath: "/repo/thread.json",
      streamingBehaviorPreference: "followUp",
      onAction,
    });

    expect(result).toEqual({ status: "sent", text: "ship it" });
    expect(onAction).toHaveBeenCalledWith("composer.send", {
      text: "ship it",
      attachments: [{ path: "/repo/file.ts", name: "file.ts", kind: "text" }],
      projectId: "/repo",
      sessionPath: "/repo/thread.json",
      streamingBehavior: "followUp",
    });
  });

  it("keeps the stored draft when send fails", async () => {
    const result = await submitComposerDraft({
      draft: "retry me",
      attachments: [],
      isSending: false,
      projectId: "/repo",
      sessionPath: "/repo/thread.json",
      streamingBehaviorPreference: "followUp",
      onAction: vi.fn(async () => {
        throw new Error("network down");
      }),
    });

    expect(result).toEqual({
      status: "error",
      errorMessage: "network down",
      text: "retry me",
    });
  });

  it("treats non-throwing send failures as errors", async () => {
    const result = await submitComposerDraft({
      draft: "retry me",
      attachments: [],
      isSending: false,
      projectId: "/repo",
      sessionPath: "/repo/thread.json",
      streamingBehaviorPreference: "followUp",
      onAction: vi.fn(async () => buildActionFailureResult("composer.send", "bridge failed")),
    });

    expect(result).toEqual({
      status: "error",
      errorMessage: "bridge failed",
      text: "retry me",
    });
  });

  it("treats null action results as errors", async () => {
    const result = await submitComposerDraft({
      draft: "retry me",
      attachments: [],
      isSending: false,
      projectId: "/repo",
      sessionPath: "/repo/thread.json",
      streamingBehaviorPreference: "followUp",
      onAction: vi.fn(async () => null),
    });

    expect(result).toEqual({
      status: "error",
      errorMessage: "Could not send prompt.",
      text: "retry me",
    });
  });

  it("treats non-throwing stop-mode send failures as errors", async () => {
    const result = await submitComposerDraft({
      draft: "stop me",
      attachments: [],
      isSending: false,
      projectId: "/repo",
      sessionPath: "/repo/thread.json",
      streamingBehaviorPreference: "stop",
      onAction: vi.fn(async () => buildActionFailureResult("composer.send", "stop failed")),
    });

    expect(result).toEqual({
      status: "error",
      errorMessage: "stop failed",
      text: "stop me",
    });
  });

  it("returns stopped when runtime converts stop-mode send into a stop", async () => {
    const result = await submitComposerDraft({
      draft: "stop me",
      attachments: [],
      isSending: false,
      projectId: "/repo",
      sessionPath: "/repo/thread.json",
      streamingBehaviorPreference: "stop",
      onAction: vi.fn(async () => buildActionSuccessResult("stopped")),
    });

    expect(result).toEqual({
      status: "stopped",
      text: "stop me",
    });
  });

  it("skips blank drafts without dispatching", async () => {
    const onAction = vi.fn(async () => null);
    await expect(
      submitComposerDraft({
        draft: "   ",
        attachments: [],
        isSending: false,
        projectId: "/repo",
        sessionPath: "/repo/thread.json",
        streamingBehaviorPreference: "followUp",
        onAction,
      }),
    ).resolves.toEqual({ status: "skipped" });

    expect(onAction).not.toHaveBeenCalled();
  });

  it("sends attachment-only drafts", async () => {
    const onAction = vi.fn(async () => buildActionSuccessResult());
    const result = await submitComposerDraft({
      draft: "   ",
      attachments: [{ path: "/repo/file.ts", name: "file.ts", kind: "text" }],
      isSending: false,
      projectId: "/repo",
      sessionPath: "/repo/thread.json",
      streamingBehaviorPreference: "followUp",
      onAction,
    });

    expect(result).toEqual({ status: "sent", text: "" });
    expect(onAction).toHaveBeenCalledWith("composer.send", {
      text: "",
      attachments: [{ path: "/repo/file.ts", name: "file.ts", kind: "text" }],
      projectId: "/repo",
      sessionPath: "/repo/thread.json",
      streamingBehavior: "followUp",
    });
  });

  it("sends compact commands without attachments and keeps stored attachments available", async () => {
    const onAction = vi.fn(async () => buildActionSuccessResult());
    const result = await submitComposerDraft({
      draft: "  /compact keep repo state  ",
      attachments: [{ path: "/repo/file.ts", name: "file.ts", kind: "text" }],
      isSending: false,
      projectId: "/repo",
      sessionPath: "/repo/thread.json",
      streamingBehaviorPreference: "followUp",
      onAction,
    });

    expect(result).toEqual({ status: "sent", text: "/compact keep repo state" });
    expect(onAction).toHaveBeenCalledWith("composer.send", {
      text: "/compact keep repo state",
      attachments: [],
      projectId: "/repo",
      sessionPath: "/repo/thread.json",
      streamingBehavior: "followUp",
    });
  });

  it("skips sends while a request is already in flight", async () => {
    const onAction = vi.fn(async () => null);

    await expect(
      submitComposerDraft({
        draft: "ship it",
        attachments: [],
        isSending: true,
        projectId: "/repo",
        sessionPath: "/repo/thread.json",
        streamingBehaviorPreference: "followUp",
        onAction,
      }),
    ).resolves.toEqual({ status: "skipped" });

    expect(onAction).not.toHaveBeenCalled();
  });
});
