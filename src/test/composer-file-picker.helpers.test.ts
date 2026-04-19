import { describe, expect, it } from "vitest";
import { resolveFileEntryActivation } from "../app/components/workspace/composer/composer-file-picker.helpers";

describe("resolveFileEntryActivation", () => {
  const attachment = {
    path: "/repo/src/main.ts",
    name: "main.ts",
    kind: "text",
  } as const;

  it("selects a file on first click", () => {
    expect(
      resolveFileEntryActivation({
        attachment,
        currentSelection: [],
        isAlreadyAttached: false,
      }),
    ).toEqual({
      type: "toggle",
      attachment,
    });
  });

  it("attaches the current selection on click once the file is selected", () => {
    expect(
      resolveFileEntryActivation({
        attachment,
        currentSelection: [attachment],
        isAlreadyAttached: false,
      }),
    ).toEqual({
      type: "attach",
      attachments: [attachment],
    });
  });

  it("ignores clicks for already attached files", () => {
    expect(
      resolveFileEntryActivation({
        attachment,
        currentSelection: [attachment],
        isAlreadyAttached: true,
      }),
    ).toEqual({ type: "noop" });
  });
});
