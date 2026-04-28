import { describe, expect, it } from "vitest";
import { getComposerPostSendCleanup } from "../app/components/workspace/composer/useComposerSubmission";
import type { ComposerAttachment } from "../app/desktop/types";

const submittedAttachments: ComposerAttachment[] = [
  { path: "/repo/a.png", name: "a.png", kind: "image" },
];
const changedAttachments: ComposerAttachment[] = [
  { path: "/repo/b.png", name: "b.png", kind: "image" },
];

describe("getComposerPostSendCleanup", () => {
  it("clears the active unchanged non-compact draft and stored draft", () => {
    expect(
      getComposerPostSendCleanup({
        activeDraftThreadId: "thread:1",
        submittedDraftThreadId: "thread:1",
        preserveAttachments: false,
        currentDraft: "ship it",
        submittedRawDraft: "ship it",
        currentAttachments: submittedAttachments,
        submittedAttachments,
      }),
    ).toEqual({
      clearStoredDraft: true,
      clearStoredPrompt: false,
      clearDraft: true,
      nextAttachments: [],
      skipNextDraftPersistence: true,
    });
  });

  it("clears a submitted stored draft after navigation without touching current UI", () => {
    expect(
      getComposerPostSendCleanup({
        activeDraftThreadId: "thread:2",
        submittedDraftThreadId: "thread:1",
        preserveAttachments: false,
        currentDraft: "other thread draft",
        submittedRawDraft: "ship it",
        currentAttachments: [],
        submittedAttachments,
      }),
    ).toEqual({
      clearStoredDraft: true,
      clearStoredPrompt: false,
      clearDraft: false,
      nextAttachments: null,
      skipNextDraftPersistence: false,
    });
  });

  it("clears sent text but preserves attachments changed during handoff", () => {
    expect(
      getComposerPostSendCleanup({
        activeDraftThreadId: "thread:1",
        submittedDraftThreadId: "thread:1",
        preserveAttachments: false,
        currentDraft: "ship it",
        submittedRawDraft: "ship it",
        currentAttachments: changedAttachments,
        submittedAttachments,
      }),
    ).toEqual({
      clearStoredDraft: false,
      clearStoredPrompt: false,
      clearDraft: true,
      nextAttachments: changedAttachments,
      skipNextDraftPersistence: false,
    });
  });

  it("preserves queued/restored draft text while removing submitted attachments", () => {
    expect(
      getComposerPostSendCleanup({
        activeDraftThreadId: "thread:1",
        submittedDraftThreadId: "thread:1",
        preserveAttachments: false,
        currentDraft: "queued prompt restored while sending",
        submittedRawDraft: "ship it",
        currentAttachments: [...submittedAttachments, ...changedAttachments],
        submittedAttachments,
      }),
    ).toEqual({
      clearStoredDraft: false,
      clearStoredPrompt: false,
      clearDraft: false,
      nextAttachments: changedAttachments,
      skipNextDraftPersistence: false,
    });
  });

  it("preserves compact command attachments and clears only the stored prompt", () => {
    expect(
      getComposerPostSendCleanup({
        activeDraftThreadId: "thread:1",
        submittedDraftThreadId: "thread:1",
        preserveAttachments: true,
        currentDraft: "/compact",
        submittedRawDraft: "/compact",
        currentAttachments: submittedAttachments,
        submittedAttachments,
      }),
    ).toEqual({
      clearStoredDraft: false,
      clearStoredPrompt: true,
      clearDraft: true,
      nextAttachments: null,
      skipNextDraftPersistence: false,
    });
  });

  it("clears compact stored prompt after navigation without touching current UI", () => {
    expect(
      getComposerPostSendCleanup({
        activeDraftThreadId: "thread:2",
        submittedDraftThreadId: "thread:1",
        preserveAttachments: true,
        currentDraft: "other thread draft",
        submittedRawDraft: "/compact",
        currentAttachments: [],
        submittedAttachments,
      }),
    ).toEqual({
      clearStoredDraft: false,
      clearStoredPrompt: true,
      clearDraft: false,
      nextAttachments: null,
      skipNextDraftPersistence: false,
    });
  });

  it("preserves text changed during handoff while removing submitted attachments", () => {
    expect(
      getComposerPostSendCleanup({
        activeDraftThreadId: "thread:1",
        submittedDraftThreadId: "thread:1",
        preserveAttachments: false,
        currentDraft: "ship it please",
        submittedRawDraft: "ship it",
        currentAttachments: submittedAttachments,
        submittedAttachments,
      }),
    ).toEqual({
      clearStoredDraft: false,
      clearStoredPrompt: false,
      clearDraft: false,
      nextAttachments: [],
      skipNextDraftPersistence: false,
    });
  });
});
