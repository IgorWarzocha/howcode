import { describe, expect, it } from "vitest";
import { getEffectiveThreadRunningState } from "../../shared/thread-running-state";

describe("thread running state", () => {
  it("uses the live runtime state when available", () => {
    expect(getEffectiveThreadRunningState(false, { isStreaming: true })).toBe(true);
    expect(getEffectiveThreadRunningState(true, { isStreaming: false })).toBe(false);
  });

  it("falls back to the persisted state when no live runtime state is known", () => {
    expect(getEffectiveThreadRunningState(true, null)).toBe(true);
    expect(getEffectiveThreadRunningState(false, null)).toBe(false);
  });
});
