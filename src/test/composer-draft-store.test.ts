import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  composerDraftStorageKey,
  createComposerDraftStore,
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
    });
    store.setDraft("session:/repo/two.json", {
      prompt: "rename the header",
      attachments: [{ path: "/repo/file.ts", name: "file.ts", kind: "text" }],
    });
    store.flush();

    expect(store.getDraft("session:/repo/one.json")).toEqual({
      prompt: "fix the timeline",
      attachments: [],
    });
    expect(store.getDraft("session:/repo/two.json")).toEqual({
      prompt: "rename the header",
      attachments: [{ path: "/repo/file.ts", name: "file.ts", kind: "text" }],
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

    store.setDraft("session:/repo/one.json", { prompt: "draft 1", attachments: [] });
    store.setDraft("session:/repo/one.json", { prompt: "draft 2", attachments: [] });

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

    store.setDraft("session:/repo/one.json", { prompt: "keep this", attachments: [] });
    store.flush();

    store.clearComposerContent("session:/repo/one.json");
    store.flush();

    expect(store.getDraft("session:/repo/one.json")).toBeNull();
    expect(storage.getItem(composerDraftStorageKey)).toBeNull();
  });
});
