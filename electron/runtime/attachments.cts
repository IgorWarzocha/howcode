import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { ImageContent } from "@mariozechner/pi-ai";
import type { ComposerAttachment } from "../../shared/desktop-contracts";

type ProcessedComposerAttachments = {
  text: string;
  images: ImageContent[];
};

function isImageAttachment(filePath: string) {
  return [".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(path.extname(filePath).toLowerCase());
}

function getImageMimeType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    default:
      return null;
  }
}

export async function processComposerAttachments(
  attachments: ComposerAttachment[],
): Promise<ProcessedComposerAttachments> {
  let text = "";
  const images: ImageContent[] = [];

  for (const attachment of attachments) {
    const fileStats = await stat(attachment.path);
    if (fileStats.size === 0) {
      continue;
    }

    if (isImageAttachment(attachment.path)) {
      const mimeType = getImageMimeType(attachment.path);
      if (!mimeType) {
        continue;
      }

      const content = await readFile(attachment.path);
      images.push({
        type: "image",
        mimeType,
        data: content.toString("base64"),
      });
      text += `<file name="${attachment.path}"></file>\n`;
      continue;
    }

    const content = await readFile(attachment.path, "utf-8");
    text += `<file name="${attachment.path}">\n${content}\n</file>\n`;
  }

  return {
    text,
    images,
  };
}
