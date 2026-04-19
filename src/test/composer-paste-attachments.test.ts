import { describe, expect, it } from "vitest";
import {
  getComposerAttachmentsFromClipboardData,
  getComposerAttachmentsFromClipboardFilePaths,
  getComposerAttachmentsFromClipboardSnapshot,
  getPreferredClipboardTextFromClipboardFilePaths,
  getPreferredClipboardTextFromClipboardSnapshot,
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
