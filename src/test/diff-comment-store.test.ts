import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDiffCommentStore,
  diffCommentStorageKey,
} from "../app/components/workspace/diff/diffCommentStore";

function createMemoryStorage() {
  const values = new Map<string, string>();

  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}

describe("diffCommentStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("persists comments and drafts per diff context", () => {
    const storage = createMemoryStorage();
    const store = createDiffCommentStore({
      storage,
      storageKey: diffCommentStorageKey,
      debounceMs: 300,
      beforeUnloadTarget: null,
    });

    store.setContext("project:/repo:worktree-diff", {
      comments: [
        {
          id: "comment-1",
          fileKey: "src/index.ts",
          filePath: "src/index.ts",
          side: "additions",
          lineNumber: 12,
          body: "Tighten this branch.",
          createdAt: "2026-04-04T00:00:00.000Z",
        },
      ],
      draft: {
        fileKey: "src/index.ts",
        filePath: "src/index.ts",
        side: "deletions",
        lineNumber: 8,
        body: "Should this move?",
      },
    });
    store.flush();

    expect(store.getContext("project:/repo:worktree-diff")).toEqual({
      comments: [
        {
          id: "comment-1",
          fileKey: "src/index.ts",
          filePath: "src/index.ts",
          side: "additions",
          lineNumber: 12,
          body: "Tighten this branch.",
          createdAt: "2026-04-04T00:00:00.000Z",
        },
      ],
      draft: {
        fileKey: "src/index.ts",
        filePath: "src/index.ts",
        side: "deletions",
        lineNumber: 8,
        body: "Should this move?",
      },
    });
  });

  it("clears contexts cleanly", () => {
    const storage = createMemoryStorage();
    const store = createDiffCommentStore({
      storage,
      storageKey: diffCommentStorageKey,
      debounceMs: 300,
      beforeUnloadTarget: null,
    });

    store.setContext("project:/repo:worktree-diff", {
      comments: [
        {
          id: "comment-1",
          fileKey: "src/index.ts",
          filePath: "src/index.ts",
          side: "additions",
          lineNumber: 12,
          body: "Tighten this branch.",
          createdAt: "2026-04-04T00:00:00.000Z",
        },
      ],
      draft: null,
    });
    store.flush();

    store.clearContext("project:/repo:worktree-diff");
    store.flush();

    expect(store.getContext("project:/repo:worktree-diff")).toBeNull();
    expect(storage.getItem(diffCommentStorageKey)).toBeNull();
  });
});
