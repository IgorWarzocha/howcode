import { describe, expect, it } from "vitest";
import {
  getComposerAttachmentsFromClipboardData,
  getComposerAttachmentsFromClipboardFilePaths,
  getComposerAttachmentsFromClipboardSnapshot,
  getPreferredClipboardTextFromClipboardData,
  getPreferredClipboardTextFromClipboardFilePaths,
  getPreferredClipboardTextFromClipboardSnapshot,
  hasAttachmentHintInClipboardData,
  hasFilePayloadInClipboardData,
} from "../app/components/workspace/composer/composer-paste-attachments";

function createClipboardData(
  input: {
    data?: Record<string, string>;
    types?: string[];
    files?: Array<{ path?: string | null; name?: string | null; type?: string | null }>;
    items?: Array<{
      kind?: string | null;
      type?: string | null;
      getAsFile?: () => { path?: string | null; name?: string | null; type?: string | null } | null;
    }>;
  } = {},
) {
  const data = input.data ?? {};
  return {
    getData: (type: string) => data[type] ?? "",
    types: input.types ?? Object.keys(data),
    files: input.files ?? [],
    items: input.items ?? [],
  };
}

describe("getComposerAttachmentsFromClipboardData", () => {
  it("extracts attachment references from clipboard text payloads", () => {
    expect(
      getComposerAttachmentsFromClipboardData(
        createClipboardData({
          data: { "text/plain": "/home/igorw/bin/setup-opencode-presence.sh" },
        }),
      ),
    ).toEqual([
      {
        path: "/home/igorw/bin/setup-opencode-presence.sh",
        name: "setup-opencode-presence.sh",
        kind: "text",
      },
    ]);

    expect(
      getComposerAttachmentsFromClipboardData(
        createClipboardData({
          data: { "x-special/gnome-copied-files": "copy\nfile:///tmp/example.png" },
        }),
      ),
    ).toEqual([{ path: "/tmp/example.png", name: "example.png", kind: "image" }]);

    expect(
      getComposerAttachmentsFromClipboardData(
        createClipboardData({
          data: { "public.file-url": "file:///Users/igorw/Desktop/example.txt" },
        }),
      ),
    ).toEqual([{ path: "/Users/igorw/Desktop/example.txt", name: "example.txt", kind: "text" }]);
  });

  it("prefers visible clipboard text unless the copied text is the attachment itself", () => {
    const linkedTextClipboard = createClipboardData({
      data: {
        "public.url": "https://example.com/docs",
        "text/plain": "Example docs",
      },
      types: ["public.url", "text/plain"],
    });

    expect(getComposerAttachmentsFromClipboardData(linkedTextClipboard)).toEqual([]);
    expect(getPreferredClipboardTextFromClipboardData(linkedTextClipboard)).toBe("Example docs");

    const matchingUrlClipboard = createClipboardData({
      data: {
        "public.url": "https://example.com/docs",
        "text/plain": "https://example.com/docs",
      },
      types: ["public.url", "text/plain"],
    });

    expect(getComposerAttachmentsFromClipboardData(matchingUrlClipboard)).toEqual([
      { path: "https://example.com/docs", name: "docs", kind: "text" },
    ]);

    expect(
      getPreferredClipboardTextFromClipboardData(
        createClipboardData({
          data: {
            "text/plain": "  function test() {\n    return 1;\n  }\n",
          },
        }),
      ),
    ).toBe("  function test() {\n    return 1;\n  }\n");
  });

  it("handles direct file payloads and early attachment hints", () => {
    expect(
      getComposerAttachmentsFromClipboardData(
        createClipboardData({
          files: [{ path: "C:/Users/igorw/Pictures/example.png", name: "example.png" }],
        }),
      ),
    ).toEqual([
      {
        path: "C:/Users/igorw/Pictures/example.png",
        name: "example.png",
        kind: "image",
      },
    ]);

    const droppedFile = { name: "external-drop.txt", type: "text/plain" };
    expect(
      getComposerAttachmentsFromClipboardData(
        createClipboardData({
          files: [droppedFile],
        }),
        {
          resolveFilePath: (file) => (file === droppedFile ? "/tmp/external-drop.txt" : null),
        },
      ),
    ).toEqual([
      {
        path: "/tmp/external-drop.txt",
        name: "external-drop.txt",
        kind: "text",
      },
    ]);

    const hintedClipboardData = createClipboardData({
      types: ["Files"],
      files: [],
      items: [],
    });
    expect(hasFilePayloadInClipboardData(hintedClipboardData)).toBe(true);
    expect(hasAttachmentHintInClipboardData(hintedClipboardData)).toBe(true);
  });

  it("reads native clipboard snapshots and file-path fallbacks", () => {
    expect(
      getComposerAttachmentsFromClipboardSnapshot({
        formats: ["text/plain"],
        valuesByFormat: { "text/plain": "/tmp/from-snapshot.txt" },
      }),
    ).toEqual([{ path: "/tmp/from-snapshot.txt", name: "from-snapshot.txt", kind: "text" }]);

    expect(
      getPreferredClipboardTextFromClipboardSnapshot({
        formats: ["text/plain"],
        valuesByFormat: { "text/plain": "hello world" },
      }),
    ).toBe("hello world");

    expect(
      getComposerAttachmentsFromClipboardFilePaths({
        filePaths: ["/tmp/native-example.png"],
        text: null,
      }),
    ).toEqual([{ path: "/tmp/native-example.png", name: "native-example.png", kind: "image" }]);

    expect(
      getComposerAttachmentsFromClipboardFilePaths({
        filePaths: [],
        text: "https://example.com/from-native",
      }),
    ).toEqual([{ path: "https://example.com/from-native", name: "from-native", kind: "text" }]);

    expect(
      getPreferredClipboardTextFromClipboardFilePaths({
        filePaths: [],
        text: "native fallback text",
      }),
    ).toBe("native fallback text");
  });
});
