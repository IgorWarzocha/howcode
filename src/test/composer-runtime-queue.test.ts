import { describe, expect, it, vi } from "vitest";
import {
  buildComposerQueueSnapshotKey,
  buildQueuedPrompts,
  cloneComposerQueue,
  findQueuedPromptIndexById,
  removeQueuedPromptById,
  replayComposerQueue,
} from "../../desktop/runtime/composer-queue";

describe("composer queue helpers", () => {
  it("replays steering and follow-up messages in order", async () => {
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

  it("builds stable prompt ids and snapshot keys for a queue snapshot", () => {
    const queue = {
      steering: ["first", "dup", "dup"],
      followUp: ["later"],
    };

    const prompts = buildQueuedPrompts(queue);
    expect(prompts.map((prompt) => prompt.id)).toEqual([
      "steer:0:first",
      "steer:0:dup",
      "steer:1:dup",
      "followUp:0:later",
    ]);
    expect(prompts.map((prompt) => prompt.queueSnapshotKey)).toEqual([
      buildComposerQueueSnapshotKey(queue),
      buildComposerQueueSnapshotKey(queue),
      buildComposerQueueSnapshotKey(queue),
      buildComposerQueueSnapshotKey(queue),
    ]);
  });

  it("finds and removes queued prompts by stable id without mutating the original queue", () => {
    const queue = {
      steering: ["dup", "dup", "other"],
      followUp: ["later"],
    };

    expect(findQueuedPromptIndexById("steer", queue.steering, "steer:1:dup")).toBe(1);
    expect(findQueuedPromptIndexById("followUp", ["other"], "followUp:0:missing")).toBeNull();

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

  it("changes snapshot keys when duplicates shift and clones snapshots safely", () => {
    expect(
      buildComposerQueueSnapshotKey({
        steering: [],
        followUp: ["dup", "dup"],
      }),
    ).not.toBe(
      buildComposerQueueSnapshotKey({
        steering: [],
        followUp: ["dup"],
      }),
    );

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
