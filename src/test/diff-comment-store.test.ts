import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDiffCommentStore,
  diffCommentStorageKey,
  getDiffCommentContextId,
} from "../app/components/workspace/diff/diffCommentStore";
import { createMemoryStorage } from "./helpers/storage";

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
          endLineNumber: 14,
          body: "Tighten this branch.",
          createdAt: "2026-04-04T00:00:00.000Z",
        },
      ],
      draft: {
        fileKey: "src/index.ts",
        filePath: "src/index.ts",
        side: "deletions",
        lineNumber: 8,
        endLineNumber: 10,
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
          endLineNumber: 14,
          body: "Tighten this branch.",
          createdAt: "2026-04-04T00:00:00.000Z",
        },
      ],
      draft: {
        fileKey: "src/index.ts",
        filePath: "src/index.ts",
        side: "deletions",
        lineNumber: 8,
        endLineNumber: 10,
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
          endLineNumber: 14,
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

  it("hydrates only valid comments and drafts and returns cloned contexts", () => {
    const storage = createMemoryStorage();

    storage.setItem(
      diffCommentStorageKey,
      JSON.stringify({
        version: 1,
        contextsById: {
          "project:/repo:worktree-diff": {
            comments: [
              {
                id: "comment-1",
                fileKey: "src/index.ts",
                filePath: "src/index.ts",
                side: "additions",
                lineNumber: 12,
                body: "Looks good",
                createdAt: "2026-04-04T00:00:00.000Z",
              },
              {
                id: "broken",
                fileKey: "src/index.ts",
                filePath: "src/index.ts",
                side: "oops",
                lineNumber: 12,
                body: "bad",
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
          },
          broken: {
            comments: [{ fileKey: "src/index.ts" }],
            draft: { fileKey: "src/index.ts" },
          },
        },
      }),
    );

    const store = createDiffCommentStore({
      storage,
      storageKey: diffCommentStorageKey,
      debounceMs: 300,
      beforeUnloadTarget: null,
    });

    const context = store.getContext("project:/repo:worktree-diff");
    expect(context).toEqual({
      comments: [
        {
          id: "comment-1",
          fileKey: "src/index.ts",
          filePath: "src/index.ts",
          side: "additions",
          lineNumber: 12,
          body: "Looks good",
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
    expect(store.getContext("broken")).toBeNull();

    if (!context?.draft) {
      throw new Error("Expected context draft to exist");
    }
    context.comments[0].body = "mutated";
    context.draft.body = "mutated";

    expect(store.getContext("project:/repo:worktree-diff")).toEqual({
      comments: [
        {
          id: "comment-1",
          fileKey: "src/index.ts",
          filePath: "src/index.ts",
          side: "additions",
          lineNumber: 12,
          body: "Looks good",
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

  it("notifies subscribers on changes and derives stable context ids", () => {
    const storage = createMemoryStorage();
    const store = createDiffCommentStore({
      storage,
      storageKey: diffCommentStorageKey,
      debounceMs: 300,
      beforeUnloadTarget: null,
    });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    expect(getDiffCommentContextId({ projectId: "/repo" })).toBe("project:/repo:worktree-diff");
    expect(getDiffCommentContextId({ projectId: "" })).toBeNull();

    store.setContext("project:/repo:worktree-diff", {
      comments: [],
      draft: {
        fileKey: "src/index.ts",
        filePath: "src/index.ts",
        side: "additions",
        lineNumber: 1,
        body: "hello",
      },
    });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.clearContext("project:/repo:worktree-diff");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
