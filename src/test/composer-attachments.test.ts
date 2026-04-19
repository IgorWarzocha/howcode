import { describe, expect, it } from "vitest";
import { buildComposerAttachmentPrompt } from "../../shared/composer-attachment-prompt";
import {
  extractComposerAttachmentsFromPaste,
  parseComposerAttachmentReference,
} from "../../shared/composer-attachments";

describe("composer attachment paste helpers", () => {
  it("parses pasted http urls into text attachments", () => {
    expect(parseComposerAttachmentReference("https://example.com/docs/getting-started")).toEqual({
      path: "https://example.com/docs/getting-started",
      name: "getting-started",
      kind: "text",
    });
  });

  it("parses file urls into local file attachments", () => {
    expect(parseComposerAttachmentReference("file:///tmp/screenshot.png")).toEqual({
      path: "/tmp/screenshot.png",
      name: "screenshot.png",
      kind: "image",
    });
  });

  it("keeps root file urls from producing blank attachment names", () => {
    expect(parseComposerAttachmentReference("file:///")).toEqual({
      path: "/",
      name: "/",
      kind: "text",
    });
  });

  it("parses newline-separated pasted references and deduplicates them", () => {
    expect(
      extractComposerAttachmentsFromPaste(`
        /repo/src/main.ts
        https://example.com/guide
        /repo/src/main.ts
      `),
    ).toEqual([
      { path: "/repo/src/main.ts", name: "main.ts", kind: "text" },
      { path: "https://example.com/guide", name: "guide", kind: "text" },
    ]);
  });

  it("supports uri-list comments without treating them as pasted prose", () => {
    expect(
      extractComposerAttachmentsFromPaste("# copied from clipboard\nhttps://example.com/guide"),
    ).toEqual([{ path: "https://example.com/guide", name: "guide", kind: "text" }]);
  });

  it("leaves mixed prose untouched by refusing to auto-attach it", () => {
    expect(extractComposerAttachmentsFromPaste("check this out https://example.com/guide")).toEqual(
      [],
    );
  });

  it("does not swallow slash commands or api routes as attachments", () => {
    expect(parseComposerAttachmentReference("/help")).toBeNull();
    expect(parseComposerAttachmentReference("/v1/chat/completions")).toBeNull();
    expect(parseComposerAttachmentReference("./build")).toBeNull();
  });
});

describe("buildComposerAttachmentPrompt", () => {
  it("describes attachments as generic references", () => {
    expect(
      buildComposerAttachmentPrompt([
        { path: "/repo/src/main.ts", name: "main.ts", kind: "text" },
        { path: "https://example.com/guide", name: "guide", kind: "text" },
      ]),
    ).toBe(
      "The user attached the following references, please use them if relevant:\n- /repo/src/main.ts\n- https://example.com/guide",
    );
  });
});
