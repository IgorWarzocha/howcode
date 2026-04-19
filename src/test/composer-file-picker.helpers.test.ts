import { describe, expect, it } from "vitest";
import { resolveFileEntryActivation } from "../app/components/workspace/composer/composer-file-picker.helpers";

describe("resolveFileEntryActivation", () => {
  const attachment = {
    path: "/repo/src/main.ts",
    name: "main.ts",
    kind: "text",
  } as const;

  const directoryAttachment = {
    path: "/repo/src",
    name: "src",
    kind: "directory",
  } as const;

  it("selects a file on first click", () => {
    expect(
      resolveFileEntryActivation({
        attachment,
        isAlreadyAttached: false,
      }),
    ).toEqual({
      type: "toggle",
      attachment,
    });
  });

  it("keeps click behavior as a toggle even when already selected", () => {
    expect(
      resolveFileEntryActivation({
        attachment,
        isAlreadyAttached: false,
      }),
    ).toEqual({
      type: "toggle",
      attachment,
    });
  });

  it("ignores clicks for already attached files", () => {
    expect(
      resolveFileEntryActivation({
        attachment,
        isAlreadyAttached: true,
      }),
    ).toEqual({ type: "noop" });
  });

  it("lets directories toggle like files when they are not already attached", () => {
    expect(
      resolveFileEntryActivation({
        attachment: directoryAttachment,
        isAlreadyAttached: false,
      }),
    ).toEqual({
      type: "toggle",
      attachment: directoryAttachment,
    });
  });
});
