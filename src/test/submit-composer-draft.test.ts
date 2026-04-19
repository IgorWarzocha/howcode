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
  it("clears the stored draft after a successful send", async () => {
    const onAction = vi.fn(async () => buildActionSuccessResult());
    const clearStoredDraft = vi.fn();

    const result = await submitComposerDraft({
      draft: "  ship it  ",
      attachments: [{ path: "/repo/file.ts", name: "file.ts", kind: "text" }],
      draftThreadId: "session:/repo/thread.json",
      isSending: false,
      projectId: "/repo",
      sessionPath: "/repo/thread.json",
      streamingBehaviorPreference: "followUp",
      onAction,
      clearStoredDraft,
    });

    expect(result).toEqual({ status: "sent", text: "ship it" });
    expect(onAction).toHaveBeenCalledWith("composer.send", {
      text: "ship it",
      attachments: [{ path: "/repo/file.ts", name: "file.ts", kind: "text" }],
      projectId: "/repo",
      sessionPath: "/repo/thread.json",
      streamingBehavior: "followUp",
    });
    expect(clearStoredDraft).toHaveBeenCalledWith("session:/repo/thread.json");
  });

  it("keeps the stored draft when send fails", async () => {
    const clearStoredDraft = vi.fn();

    const result = await submitComposerDraft({
      draft: "retry me",
      attachments: [],
      draftThreadId: "session:/repo/thread.json",
      isSending: false,
      projectId: "/repo",
      sessionPath: "/repo/thread.json",
      streamingBehaviorPreference: "followUp",
      onAction: vi.fn(async () => {
        throw new Error("network down");
      }),
      clearStoredDraft,
    });

    expect(result).toEqual({
      status: "error",
      errorMessage: "network down",
      text: "retry me",
    });
    expect(clearStoredDraft).not.toHaveBeenCalled();
  });

  it("treats non-throwing send failures as errors", async () => {
    const clearStoredDraft = vi.fn();

    const result = await submitComposerDraft({
      draft: "retry me",
      attachments: [],
      draftThreadId: "session:/repo/thread.json",
      isSending: false,
      projectId: "/repo",
      sessionPath: "/repo/thread.json",
      streamingBehaviorPreference: "followUp",
      onAction: vi.fn(async () => buildActionFailureResult("composer.send", "bridge failed")),
      clearStoredDraft,
    });

    expect(result).toEqual({
      status: "error",
      errorMessage: "bridge failed",
      text: "retry me",
    });
    expect(clearStoredDraft).not.toHaveBeenCalled();
  });

  it("treats null action results as errors", async () => {
    const clearStoredDraft = vi.fn();

    const result = await submitComposerDraft({
      draft: "retry me",
      attachments: [],
      draftThreadId: "session:/repo/thread.json",
      isSending: false,
      projectId: "/repo",
      sessionPath: "/repo/thread.json",
      streamingBehaviorPreference: "followUp",
      onAction: vi.fn(async () => null),
      clearStoredDraft,
    });

    expect(result).toEqual({
      status: "error",
      errorMessage: "Could not send prompt.",
      text: "retry me",
    });
    expect(clearStoredDraft).not.toHaveBeenCalled();
  });

  it("treats non-throwing stop-mode send failures as errors", async () => {
    const clearStoredDraft = vi.fn();

    const result = await submitComposerDraft({
      draft: "stop me",
      attachments: [],
      draftThreadId: "session:/repo/thread.json",
      isSending: false,
      projectId: "/repo",
      sessionPath: "/repo/thread.json",
      streamingBehaviorPreference: "stop",
      onAction: vi.fn(async () => buildActionFailureResult("composer.send", "stop failed")),
      clearStoredDraft,
    });

    expect(result).toEqual({
      status: "error",
      errorMessage: "stop failed",
      text: "stop me",
    });
    expect(clearStoredDraft).not.toHaveBeenCalled();
  });

  it("returns stopped when runtime converts stop-mode send into a stop", async () => {
    const clearStoredDraft = vi.fn();

    const result = await submitComposerDraft({
      draft: "stop me",
      attachments: [],
      draftThreadId: "session:/repo/thread.json",
      isSending: false,
      projectId: "/repo",
      sessionPath: "/repo/thread.json",
      streamingBehaviorPreference: "stop",
      onAction: vi.fn(async () => buildActionSuccessResult("stopped")),
      clearStoredDraft,
    });

    expect(result).toEqual({
      status: "stopped",
      text: "stop me",
    });
    expect(clearStoredDraft).not.toHaveBeenCalled();
  });

  it("skips blank drafts without dispatching", async () => {
    const onAction = vi.fn(async () => null);
    const clearStoredDraft = vi.fn();

    await expect(
      submitComposerDraft({
        draft: "   ",
        attachments: [],
        draftThreadId: "session:/repo/thread.json",
        isSending: false,
        projectId: "/repo",
        sessionPath: "/repo/thread.json",
        streamingBehaviorPreference: "followUp",
        onAction,
        clearStoredDraft,
      }),
    ).resolves.toEqual({ status: "skipped" });

    expect(onAction).not.toHaveBeenCalled();
    expect(clearStoredDraft).not.toHaveBeenCalled();
  });

  it("sends attachment-only drafts", async () => {
    const onAction = vi.fn(async () => buildActionSuccessResult());
    const clearStoredDraft = vi.fn();

    const result = await submitComposerDraft({
      draft: "   ",
      attachments: [{ path: "/repo/file.ts", name: "file.ts", kind: "text" }],
      draftThreadId: "session:/repo/thread.json",
      isSending: false,
      projectId: "/repo",
      sessionPath: "/repo/thread.json",
      streamingBehaviorPreference: "followUp",
      onAction,
      clearStoredDraft,
    });

    expect(result).toEqual({ status: "sent", text: "" });
    expect(onAction).toHaveBeenCalledWith("composer.send", {
      text: "",
      attachments: [{ path: "/repo/file.ts", name: "file.ts", kind: "text" }],
      projectId: "/repo",
      sessionPath: "/repo/thread.json",
      streamingBehavior: "followUp",
    });
    expect(clearStoredDraft).toHaveBeenCalledWith("session:/repo/thread.json");
  });

  it("skips sends while a request is already in flight", async () => {
    const onAction = vi.fn(async () => null);

    await expect(
      submitComposerDraft({
        draft: "ship it",
        attachments: [],
        draftThreadId: "session:/repo/thread.json",
        isSending: true,
        projectId: "/repo",
        sessionPath: "/repo/thread.json",
        streamingBehaviorPreference: "followUp",
        onAction,
        clearStoredDraft: vi.fn(),
      }),
    ).resolves.toEqual({ status: "skipped" });

    expect(onAction).not.toHaveBeenCalled();
  });
});
