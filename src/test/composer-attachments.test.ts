import { describe, expect, it } from "vitest";
import { buildComposerAttachmentPrompt } from "../../shared/composer-attachment-prompt";
import {
  extractComposerAttachmentsFromPaste,
  normalizeComposerAttachments,
  parseComposerAttachmentReference,
} from "../../shared/composer-attachments";

describe("composer attachment paste helpers", () => {
  it("parses representative reference types and rejects command-like input", () => {
    expect(parseComposerAttachmentReference("https://example.com/docs/getting-started")).toEqual({
      path: "https://example.com/docs/getting-started",
      name: "getting-started",
      kind: "text",
    });

    expect(parseComposerAttachmentReference("file:///tmp/screenshot.png")).toEqual({
      path: "/tmp/screenshot.png",
      name: "screenshot.png",
      kind: "image",
    });

    expect(parseComposerAttachmentReference("file:///")).toEqual({
      path: "/",
      name: "/",
      kind: "text",
    });

    expect(parseComposerAttachmentReference("/repo")).toEqual({
      path: "/repo",
      name: "repo",
      kind: "text",
    });

    expect(parseComposerAttachmentReference("/data/project/file.txt")).toEqual({
      path: "/data/project/file.txt",
      name: "file.txt",
      kind: "text",
    });

    expect(parseComposerAttachmentReference("./build")).toBeNull();
    expect(parseComposerAttachmentReference("~/notes.txt")).toBeNull();
    expect(parseComposerAttachmentReference("../src/app.ts")).toBeNull();
  });

  it("auto-attaches only clean pasted references", () => {
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

    expect(
      extractComposerAttachmentsFromPaste("# copied from clipboard\nhttps://example.com/guide", {
        sourceType: "text/uri-list",
      }),
    ).toEqual([{ path: "https://example.com/guide", name: "guide", kind: "text" }]);

    expect(extractComposerAttachmentsFromPaste("# Heading\n/tmp/file.ts")).toEqual([]);
    expect(extractComposerAttachmentsFromPaste("check this out https://example.com/guide")).toEqual(
      [],
    );
  });
});

describe("buildComposerAttachmentPrompt", () => {
  it("splits local files, folders, and urls into separate instructions", () => {
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

  it("normalizes local attachments based on path-kind resolution", () => {
    expect(
      normalizeComposerAttachments([{ path: "/repo/src", name: "src", kind: "text" }], {
        resolveAttachmentKind: (path) => (path === "/repo/src" ? "directory" : null),
      }),
    ).toEqual([{ path: "/repo/src", name: "src", kind: "directory" }]);

    expect(
      normalizeComposerAttachments(
        [{ path: "/tmp/missing.txt", name: "missing.txt", kind: "text" }],
        {
          resolveAttachmentKind: () => null,
        },
      ),
    ).toEqual([]);
  });
});
