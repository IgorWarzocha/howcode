import { describe, expect, it } from "vitest";
import { buildComposerAttachmentPrompt } from "../../shared/composer-attachment-prompt";
import {
  extractComposerAttachmentsFromPaste,
  normalizeComposerAttachments,
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
      extractComposerAttachmentsFromPaste("# copied from clipboard\nhttps://example.com/guide", {
        sourceType: "text/uri-list",
      }),
    ).toEqual([{ path: "https://example.com/guide", name: "guide", kind: "text" }]);
  });

  it("does not treat markdown headings as uri-list comments in plain text", () => {
    expect(extractComposerAttachmentsFromPaste("# Heading\n/tmp/file.ts")).toEqual([]);
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

  it("parses single-segment absolute unix paths from the allowlist", () => {
    expect(parseComposerAttachmentReference("/repo")).toEqual({
      path: "/repo",
      name: "repo",
      kind: "text",
    });
    expect(parseComposerAttachmentReference("/tmp")).toEqual({
      path: "/tmp",
      name: "tmp",
      kind: "text",
    });
  });
});

describe("buildComposerAttachmentPrompt", () => {
  it("asks the agent to read local files and inspect folders while keeping urls as softer references", () => {
    expect(
      buildComposerAttachmentPrompt([
        { path: "/repo/src/main.ts", name: "main.ts", kind: "text" },
        { path: "/repo/src", name: "src", kind: "directory" },
        { path: "https://example.com/guide", name: "guide", kind: "text" },
      ]),
    ).toBe(
      "The user attached the following files, please read them:\n- /repo/src/main.ts\n\nThe user attached the following folders, please inspect the relevant files within them if needed:\n- /repo/src\n\nThe user attached the following references, please use them if relevant:\n- https://example.com/guide",
    );
  });

  it("can normalize folder attachments with a path-kind resolver", () => {
    expect(
      normalizeComposerAttachments([{ path: "/repo/src", name: "src", kind: "text" }], {
        resolveAttachmentKind: (path) => (path === "/repo/src" ? "directory" : null),
      }),
    ).toEqual([{ path: "/repo/src", name: "src", kind: "directory" }]);
  });
});
