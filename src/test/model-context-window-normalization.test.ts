import { describe, expect, it } from "vitest";
import { normalizeModelContextWindowValue } from "../../shared/model-context-window-normalization";

describe("model context window normalization", () => {
  it("treats dot-formatted token windows as thousands-grouped values", () => {
    expect(normalizeModelContextWindowValue(202.752)).toBe(202_752);
    expect(normalizeModelContextWindowValue(8.192)).toBe(8_192);
  });

  it("keeps normal integer context windows unchanged", () => {
    expect(normalizeModelContextWindowValue(128_000)).toBe(128_000);
    expect(normalizeModelContextWindowValue(1_048_576)).toBe(1_048_576);
  });
});
