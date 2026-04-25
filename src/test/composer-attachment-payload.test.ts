import { describe, expect, it } from "vitest";
import { normalizeComposerSendAttachments } from "../../desktop/pi-threads/composer-attachment-payload";
import type { ComposerAttachment } from "../../shared/desktop-contracts";

function createStat(existingPaths: Record<string, "directory" | "file">) {
  return async (attachmentPath: string) => {
    const entry = existingPaths[attachmentPath];
    if (!entry) {
      throw new Error(`Missing test path: ${attachmentPath}`);
    }

    return { isDirectory: () => entry === "directory" };
  };
}

describe("normalizeComposerSendAttachments", () => {
  it("trims, dedupes, and reclassifies local attachment payloads before send", async () => {
    const attachments: ComposerAttachment[] = [
      { path: " /repo/src ", name: " src ", kind: "text" },
      { path: "/repo/src", name: "old", kind: "text" },
      { path: "/repo/src/../screenshot.png", name: "", kind: "text" },
      { path: "//server/share/image.png", name: "image.png", kind: "text" },
    ];

    await expect(
      normalizeComposerSendAttachments(attachments, {
        platform: "win32",
        statAttachmentPath: createStat({
          "/repo/src": "directory",
          "/repo/src/../screenshot.png": "file",
          "//server/share/image.png": "file",
        }),
      }),
    ).resolves.toEqual({
      attachments: [
        { path: "/repo/src", name: "old", kind: "directory" },
        { path: "/repo/screenshot.png", name: "screenshot.png", kind: "image" },
        { path: "\\\\server\\share\\image.png", name: "image.png", kind: "image" },
      ],
      rejected: false,
    });
  });

  it("reports actual rejected attachments without treating dedupe as rejection", async () => {
    const attachments: ComposerAttachment[] = [
      { path: "/repo/file.ts", name: "file.ts", kind: "text" },
      { path: " /repo/file.ts ", name: "duplicate.ts", kind: "text" },
      { path: "/repo/missing.txt", name: "missing.txt", kind: "text" },
      { path: "   ", name: "blank", kind: "text" },
      { path: "ftp://example.com/file.txt", name: "file.txt", kind: "text" },
      { path: "relative/file.txt", name: "file.txt", kind: "text" },
      { path: "////", name: "root", kind: "directory" },
      { path: "/tmp/..", name: "root", kind: "directory" },
      { path: "/repo/bad\nname.ts", name: "bad", kind: "text" },
      { path: "https://example.com/guide", name: "Guide", kind: "image" },
    ];

    await expect(
      normalizeComposerSendAttachments(attachments, {
        platform: "linux",
        statAttachmentPath: createStat({
          "/repo/file.ts": "file",
        }),
      }),
    ).resolves.toEqual({
      attachments: [
        { path: "/repo/file.ts", name: "duplicate.ts", kind: "text" },
        { path: "https://example.com/guide", name: "Guide", kind: "text" },
      ],
      rejected: true,
    });
  });

  it("keeps forward-slash double-root POSIX paths on POSIX platforms", async () => {
    await expect(
      normalizeComposerSendAttachments(
        [{ path: "//server/share/file.ts", name: "file.ts", kind: "text" }],
        {
          platform: "linux",
          statAttachmentPath: createStat({
            "//server/share/file.ts": "file",
          }),
        },
      ),
    ).resolves.toEqual({
      attachments: [{ path: "/server/share/file.ts", name: "file.ts", kind: "text" }],
      rejected: false,
    });
  });
});
