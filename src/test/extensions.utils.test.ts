import { describe, expect, it } from "vitest";
import { getSafeExternalUrl, pickSafeExternalUrl } from "../app/features/extensions/utils";

describe("extensions utils", () => {
  it("accepts only safe http urls", () => {
    expect(getSafeExternalUrl("https://example.com/pkg")).toBe("https://example.com/pkg");
    expect(getSafeExternalUrl("git+https://github.com/user/repo")).toBe(
      "https://github.com/user/repo",
    );
    expect(getSafeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(getSafeExternalUrl("file:///tmp/test")).toBeNull();
  });

  it("falls back to the first safe external url", () => {
    expect(
      pickSafeExternalUrl([
        "javascript:alert(1)",
        "file:///tmp/test",
        "https://www.npmjs.com/package/example",
      ]),
    ).toBe("https://www.npmjs.com/package/example");
  });
});
