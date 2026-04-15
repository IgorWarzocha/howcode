import { describe, expect, it, vi } from "vitest";
import { submitComposerDraft } from "../app/components/workspace/composer/submitComposerDraft";

describe("submitComposerDraft", () => {
  it("clears the stored draft after a successful send", async () => {
    const onAction = vi.fn(async () => null);
    const clearStoredDraft = vi.fn();

    const result = await submitComposerDraft({
      draft: "  ship it  ",
      attachments: [{ path: "/repo/file.ts", name: "file.ts", kind: "text" }],
      draftThreadId: "session:/repo/thread.json",
      isSending: false,
      isStreaming: false,
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
      isStreaming: false,
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

  it("skips blank drafts without dispatching", async () => {
    const onAction = vi.fn(async () => null);
    const clearStoredDraft = vi.fn();

    await expect(
      submitComposerDraft({
        draft: "   ",
        attachments: [],
        draftThreadId: "session:/repo/thread.json",
        isSending: false,
        isStreaming: false,
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

  it("skips sends while a request is already in flight", async () => {
    const onAction = vi.fn(async () => null);

    await expect(
      submitComposerDraft({
        draft: "ship it",
        attachments: [],
        draftThreadId: "session:/repo/thread.json",
        isSending: true,
        isStreaming: false,
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
