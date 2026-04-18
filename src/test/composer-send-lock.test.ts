import { describe, expect, it, vi } from "vitest";
import { withComposerSendLock } from "../app/components/workspace/composer/composerSendLock";

describe("withComposerSendLock", () => {
  it("prevents a duplicate send while dictation shutdown is still pending", async () => {
    const lock = { current: false };
    let releaseFirstSend!: () => void;
    const firstSendReachedFlush = vi.fn();
    const secondSend = vi.fn(async () => "second");

    const firstSend = withComposerSendLock(lock, async () => {
      firstSendReachedFlush();
      await new Promise<void>((resolve) => {
        releaseFirstSend = resolve;
      });
      return "first";
    });

    expect(firstSendReachedFlush).toHaveBeenCalledTimes(1);

    await expect(withComposerSendLock(lock, secondSend)).resolves.toBeUndefined();
    expect(secondSend).not.toHaveBeenCalled();

    releaseFirstSend();
    await expect(firstSend).resolves.toBe("first");
    expect(lock.current).toBe(false);
  });
});
