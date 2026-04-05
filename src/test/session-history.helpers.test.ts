import { describe, expect, it } from "vitest";
import { clampHistory } from "../../desktop/terminal/session-history.helpers";

describe("session history helpers", () => {
  it("trims transcript history to the most recent supported window", () => {
    const history = "x".repeat(200_100);
    const clamped = clampHistory(history);

    expect(clamped).toHaveLength(200_000);
    expect(clamped).toBe(history.slice(-200_000));
  });
});
