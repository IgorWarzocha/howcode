import { describe, expect, it } from "vitest";
import {
  getComposerAttachmentsFromClipboardData,
  getComposerAttachmentsFromClipboardFilePaths,
  getComposerAttachmentsFromClipboardSnapshot,
  getPreferredClipboardTextFromClipboardData,
  getPreferredClipboardTextFromClipboardFilePaths,
  getPreferredClipboardTextFromClipboardSnapshot,
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
  it("reads plain text absolute paths", () => {
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
  });

  it("handles gnome copied files payloads", () => {
    expect(
      getComposerAttachmentsFromClipboardData(
        createClipboardData({
          data: { "x-special/gnome-copied-files": "copy\nfile:///tmp/example.png" },
        }),
      ),
    ).toEqual([{ path: "/tmp/example.png", name: "example.png", kind: "image" }]);
  });

  it("handles macOS-style public file urls", () => {
    expect(
      getComposerAttachmentsFromClipboardData(
        createClipboardData({
          data: { "public.file-url": "file:///Users/igorw/Desktop/example.txt" },
        }),
      ),
    ).toEqual([{ path: "/Users/igorw/Desktop/example.txt", name: "example.txt", kind: "text" }]);
  });

  it("prefers visible plain text over public.url metadata when copying linked text", () => {
    const clipboardData = createClipboardData({
      data: {
        "public.url": "https://example.com/docs",
        "text/plain": "Example docs",
      },
      types: ["public.url", "text/plain"],
    });

    expect(getComposerAttachmentsFromClipboardData(clipboardData)).toEqual([]);
    expect(getPreferredClipboardTextFromClipboardData(clipboardData)).toBe("Example docs");
  });

  it("still auto-attaches public.url metadata when plain text matches the url", () => {
    const clipboardData = createClipboardData({
      data: {
        "public.url": "https://example.com/docs",
        "text/plain": "https://example.com/docs",
      },
      types: ["public.url", "text/plain"],
    });

    expect(getComposerAttachmentsFromClipboardData(clipboardData)).toEqual([
      { path: "https://example.com/docs", name: "docs", kind: "text" },
    ]);
  });

  it("uses file objects when Electron exposes pasted files directly", () => {
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
  });

  it("uses a file-path resolver for dropped files without an exposed path", () => {
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
  });

  it("detects external file drags before files are populated", () => {
    expect(
      hasFilePayloadInClipboardData(
        createClipboardData({
          types: ["Files"],
          files: [],
          items: [],
        }),
      ),
    ).toBe(true);
  });

  it("reads attachment references from electron clipboard snapshots", () => {
    expect(
      getComposerAttachmentsFromClipboardSnapshot({
        formats: ["text/plain"],
        valuesByFormat: { "text/plain": "/tmp/from-snapshot.txt" },
      }),
    ).toEqual([{ path: "/tmp/from-snapshot.txt", name: "from-snapshot.txt", kind: "text" }]);
  });

  it("picks fallback plain text from clipboard snapshots", () => {
    expect(
      getPreferredClipboardTextFromClipboardSnapshot({
        formats: ["text/plain"],
        valuesByFormat: { "text/plain": "hello world" },
      }),
    ).toBe("hello world");
  });

  it("converts native clipboard file paths into attachments", () => {
    expect(
      getComposerAttachmentsFromClipboardFilePaths({
        filePaths: ["/tmp/native-example.png"],
        text: null,
      }),
    ).toEqual([{ path: "/tmp/native-example.png", name: "native-example.png", kind: "image" }]);
  });

  it("falls back to parsing native clipboard text when no file paths are present", () => {
    expect(
      getComposerAttachmentsFromClipboardFilePaths({
        filePaths: [],
        text: "https://example.com/from-native",
      }),
    ).toEqual([{ path: "https://example.com/from-native", name: "from-native", kind: "text" }]);
  });

  it("returns preferred native clipboard text", () => {
    expect(
      getPreferredClipboardTextFromClipboardFilePaths({
        filePaths: [],
        text: "native fallback text",
      }),
    ).toBe("native fallback text");
  });
});
