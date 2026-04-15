import { describe, expect, it } from "vitest";
import { mergeDraftWithRestoredQueuedPrompt } from "../app/components/workspace/composer/composer-queue.helpers";

describe("mergeDraftWithRestoredQueuedPrompt", () => {
  it("uses the restored queued prompt when the composer draft is empty", () => {
    expect(mergeDraftWithRestoredQueuedPrompt("", "queued prompt")).toBe("queued prompt");
  });

  it("preserves the current draft when restoring a queued prompt", () => {
    expect(mergeDraftWithRestoredQueuedPrompt("keep this draft", "queued prompt")).toBe(
      "keep this draft\n\nqueued prompt",
    );
  });

  it("avoids duplicating identical draft text", () => {
    expect(mergeDraftWithRestoredQueuedPrompt("queued prompt", "queued prompt")).toBe(
      "queued prompt",
    );
  });
});
