import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  composerDraftStorageKey,
  createComposerDraftStore,
  getComposerDraftThreadId,
} from "../app/components/workspace/composer/composerDraftStore";
import { createMemoryStorage } from "./helpers/storage";

describe("composerDraftStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("persists drafts per thread without bleed", () => {
    const storage = createMemoryStorage();
    const store = createComposerDraftStore({
      storage,
      storageKey: composerDraftStorageKey,
      debounceMs: 300,
      beforeUnloadTarget: null,
    });

    store.setDraft("session:/repo/one.json", {
      prompt: "fix the timeline",
      attachments: [],
      pickerOpen: false,
    });
    store.setDraft("session:/repo/two.json", {
      prompt: "rename the header",
      attachments: [{ path: "/repo/file.ts", name: "file.ts", kind: "text" }],
      pickerOpen: false,
    });
    store.flush();

    expect(store.getDraft("session:/repo/one.json")).toEqual({
      prompt: "fix the timeline",
      attachments: [],
      pickerOpen: false,
    });
    expect(store.getDraft("session:/repo/two.json")).toEqual({
      prompt: "rename the header",
      attachments: [{ path: "/repo/file.ts", name: "file.ts", kind: "text" }],
      pickerOpen: false,
    });
  });

  it("hydrates valid drafts on reload and ignores malformed entries", () => {
    const storage = createMemoryStorage();

    storage.setItem(
      composerDraftStorageKey,
      JSON.stringify({
        version: 1,
        draftsByThreadId: {
          "session:/repo/one.json": {
            prompt: "restored prompt",
            pickerOpen: true,
            attachments: [
              { path: "/repo/image.png", name: "image.png", kind: "image" },
              { path: 42, name: "bad", kind: "text" },
            ],
          },
          broken: { prompt: 42 },
        },
      }),
    );

    const store = createComposerDraftStore({
      storage,
      storageKey: composerDraftStorageKey,
      debounceMs: 300,
      beforeUnloadTarget: null,
    });

    expect(store.getDraft("session:/repo/one.json")).toEqual({
      prompt: "restored prompt",
      attachments: [{ path: "/repo/image.png", name: "image.png", kind: "image" }],
      pickerOpen: true,
    });
    expect(store.getDraft("broken")).toBeNull();
  });

  it("debounces writes until the wait window elapses", () => {
    const storage = createMemoryStorage();
    const store = createComposerDraftStore({
      storage,
      storageKey: composerDraftStorageKey,
      debounceMs: 300,
      beforeUnloadTarget: null,
    });

    store.setDraft("session:/repo/one.json", {
      prompt: "draft 1",
      attachments: [],
      pickerOpen: false,
    });
    store.setDraft("session:/repo/one.json", {
      prompt: "draft 2",
      attachments: [],
      pickerOpen: false,
    });

    expect(storage.getItem(composerDraftStorageKey)).toBeNull();

    vi.advanceTimersByTime(299);
    expect(storage.getItem(composerDraftStorageKey)).toBeNull();

    vi.advanceTimersByTime(1);

    expect(JSON.parse(storage.getItem(composerDraftStorageKey) ?? "null")).toEqual({
      version: 1,
      draftsByThreadId: {
        "session:/repo/one.json": {
          prompt: "draft 2",
        },
      },
    });
  });

  it("prunes empty drafts from storage", () => {
    const storage = createMemoryStorage();
    const store = createComposerDraftStore({
      storage,
      storageKey: composerDraftStorageKey,
      debounceMs: 300,
      beforeUnloadTarget: null,
    });

    store.setDraft("session:/repo/one.json", {
      prompt: "keep this",
      attachments: [],
      pickerOpen: false,
    });
    store.flush();

    store.clearComposerContent("session:/repo/one.json");
    store.flush();

    expect(store.getDraft("session:/repo/one.json")).toBeNull();
    expect(storage.getItem(composerDraftStorageKey)).toBeNull();
  });

  it("derives draft thread ids from session paths and project ids", () => {
    expect(getComposerDraftThreadId({ projectId: "/repo", sessionPath: "/repo/thread.json" })).toBe(
      "session:/repo/thread.json",
    );
    expect(
      getComposerDraftThreadId({ projectId: "/repo", sessionPath: "local://%2Frepo/new-thread" }),
    ).toBe("session:local://%2Frepo/new-thread");
    expect(getComposerDraftThreadId({ projectId: "/repo", sessionPath: null })).toBe(
      "project:/repo:new-thread",
    );
    expect(getComposerDraftThreadId({ projectId: "", sessionPath: null })).toBeNull();
  });

  it("keeps local drafts separate while mirroring the latest project draft", () => {
    const storage = createMemoryStorage();
    const store = createComposerDraftStore({
      storage,
      storageKey: composerDraftStorageKey,
      debounceMs: 300,
      beforeUnloadTarget: null,
    });

    const firstLocalThreadId = "session:local://%2Frepo/first";
    const secondLocalThreadId = "session:local://%2Frepo/second";
    const projectDraftThreadId = "project:/repo:new-thread";

    store.setDraft(firstLocalThreadId, {
      prompt: "first draft",
      attachments: [],
      pickerOpen: false,
    });
    store.setDraft(secondLocalThreadId, {
      prompt: "second draft",
      attachments: [],
      pickerOpen: false,
    });

    expect(store.getDraft(firstLocalThreadId)).toEqual({
      prompt: "first draft",
      attachments: [],
      pickerOpen: false,
    });
    expect(store.getDraft(secondLocalThreadId)).toEqual({
      prompt: "second draft",
      attachments: [],
      pickerOpen: false,
    });
    expect(store.getDraft(projectDraftThreadId)).toEqual({
      prompt: "second draft",
      attachments: [],
      pickerOpen: false,
    });

    store.clearThreadDraft(firstLocalThreadId);
    expect(store.getDraft(projectDraftThreadId)).toEqual({
      prompt: "second draft",
      attachments: [],
      pickerOpen: false,
    });

    store.clearThreadDraft(secondLocalThreadId);
    expect(store.getDraft(projectDraftThreadId)).toBeNull();
  });

  it("returns cloned drafts so callers cannot mutate store state", () => {
    const storage = createMemoryStorage();
    const store = createComposerDraftStore({
      storage,
      storageKey: composerDraftStorageKey,
      debounceMs: 300,
      beforeUnloadTarget: null,
    });

    store.setDraft("session:/repo/one.json", {
      prompt: "rename the header",
      attachments: [{ path: "/repo/file.ts", name: "file.ts", kind: "text" }],
      pickerOpen: false,
    });

    const draft = store.getDraft("session:/repo/one.json");
    if (!draft) {
      throw new Error("Expected draft to exist");
    }
    draft.prompt = "mutated";
    draft.attachments[0].name = "mutated.ts";

    expect(store.getDraft("session:/repo/one.json")).toEqual({
      prompt: "rename the header",
      attachments: [{ path: "/repo/file.ts", name: "file.ts", kind: "text" }],
      pickerOpen: false,
    });
  });

  it("persists picker open state even without prompt text or attachments", () => {
    const storage = createMemoryStorage();
    const store = createComposerDraftStore({
      storage,
      storageKey: composerDraftStorageKey,
      debounceMs: 300,
      beforeUnloadTarget: null,
    });

    store.setDraft("session:/repo/one.json", {
      prompt: "",
      attachments: [],
      pickerOpen: true,
    });
    store.flush();

    expect(store.getDraft("session:/repo/one.json")).toEqual({
      prompt: "",
      attachments: [],
      pickerOpen: true,
    });
    expect(JSON.parse(storage.getItem(composerDraftStorageKey) ?? "null")).toEqual({
      version: 1,
      draftsByThreadId: {
        "session:/repo/one.json": {
          prompt: "",
          pickerOpen: true,
        },
      },
    });
  });
});
