import { describe, expect, it } from "vitest";

import { getSafeExternalUrl, isSafeExternalUrl } from "../../shared/external-url";

describe("external URL safety", () => {
  it("accepts and canonicalizes http and https URLs", () => {
    expect(getSafeExternalUrl("https://example.com/path with spaces?q=hello world")).toBe(
      "https://example.com/path%20with%20spaces?q=hello%20world",
    );
    expect(getSafeExternalUrl("https://skills.sh")).toBe("https://skills.sh/");
  });

  it("strips git+ prefixes before returning the URL to open", () => {
    expect(getSafeExternalUrl("git+https://example.com/repo.git")).toBe(
      "https://example.com/repo.git",
    );
  });

  it("rejects non-web schemes", () => {
    expect(getSafeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(getSafeExternalUrl("git+ssh://example.com/repo.git")).toBeNull();
    expect(isSafeExternalUrl("file:///tmp/readme.md")).toBe(false);
  });
});
