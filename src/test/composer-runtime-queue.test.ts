import { describe, expect, it, vi } from "vitest";
import {
  buildQueuedPrompts,
  cloneComposerQueue,
  findQueuedPromptIndexById,
  removeQueuedPromptById,
  replayComposerQueue,
} from "../../desktop/runtime/composer-queue";

describe("replayComposerQueue", () => {
  it("requeues steering and follow-up messages in order", async () => {
    const steer = vi.fn(async () => undefined);
    const followUp = vi.fn(async () => undefined);

    await replayComposerQueue(
      { steer, followUp },
      {
        steering: ["steer-1", "steer-2"],
        followUp: ["follow-1", "follow-2"],
      },
    );

    expect(steer.mock.calls).toEqual([["steer-1"], ["steer-2"]]);
    expect(followUp.mock.calls).toEqual([["follow-1"], ["follow-2"]]);
  });
});

describe("composer queue helpers", () => {
  it("builds stable ids that do not depend on unrelated queue positions", () => {
    expect(
      buildQueuedPrompts({
        steering: ["first", "dup", "dup"],
        followUp: ["later"],
      }).map((prompt) => prompt.id),
    ).toEqual(["steer:0:first", "steer:0:dup", "steer:1:dup", "followUp:0:later"]);

    expect(
      buildQueuedPrompts({
        steering: ["dup", "dup"],
        followUp: ["later"],
      }).map((prompt) => prompt.id),
    ).toEqual(["steer:0:dup", "steer:1:dup", "followUp:0:later"]);
  });

  it("finds the current queue index from a stable queue id", () => {
    expect(findQueuedPromptIndexById("steer", ["dup", "dup", "other"], "steer:1:dup")).toBe(1);
    expect(findQueuedPromptIndexById("followUp", ["other"], "followUp:0:missing")).toBeNull();
  });

  it("removes a queued prompt by stable id without mutating the original queue", () => {
    const queue = {
      steering: ["dup", "dup", "other"],
      followUp: ["later"],
    };

    expect(removeQueuedPromptById(queue, "steer", "steer:1:dup")).toEqual({
      dequeuedText: "dup",
      nextQueue: {
        steering: ["dup", "other"],
        followUp: ["later"],
      },
    });
    expect(queue).toEqual({
      steering: ["dup", "dup", "other"],
      followUp: ["later"],
    });
  });

  it("clones queue snapshots for safe replay rollback", () => {
    const queue = {
      steering: ["one"],
      followUp: ["two"],
    };

    const clone = cloneComposerQueue(queue);
    clone.steering.push("three");

    expect(queue).toEqual({
      steering: ["one"],
      followUp: ["two"],
    });
  });
});
