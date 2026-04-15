import { describe, expect, it, vi } from "vitest";
import { replayComposerQueue } from "../../desktop/runtime/composer-queue";

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
