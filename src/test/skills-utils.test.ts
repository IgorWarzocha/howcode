import { afterEach, describe, expect, it, vi } from "vitest";

import { openExternalUrl } from "../app/features/skills/utils";

describe("skills external URLs", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects unsafe browser fallback URLs", async () => {
    const open = vi.fn();
    vi.stubGlobal("window", { open });

    await expect(openExternalUrl("javascript:alert(1)")).resolves.toBe(false);

    expect(open).not.toHaveBeenCalled();
  });

  it("opens safe browser fallback URLs", async () => {
    const open = vi.fn();
    vi.stubGlobal("window", { open });

    await expect(openExternalUrl("https://skills.sh")).resolves.toBe(true);

    expect(open).toHaveBeenCalledWith("https://skills.sh", "_blank", "noopener,noreferrer");
  });

  it("delegates safe desktop URLs to the bridge", async () => {
    const openExternal = vi.fn().mockResolvedValue(true);
    vi.stubGlobal("window", { piDesktop: { openExternal } });

    await expect(openExternalUrl("https://skills.sh")).resolves.toBe(true);

    expect(openExternal).toHaveBeenCalledWith("https://skills.sh");
  });
});
