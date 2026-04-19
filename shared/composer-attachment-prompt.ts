import type { ComposerAttachment } from "./desktop-data-contracts";

export function buildComposerAttachmentPrompt(attachments: ComposerAttachment[]): string {
  const attachmentPaths = attachments
    .map((attachment) => attachment.path.trim())
    .filter((path) => path.length > 0);

  if (attachmentPaths.length === 0) {
    return "";
  }

  return `The user attached the following references, please use them if relevant:\n${attachmentPaths.map((path) => `- ${path}`).join("\n")}`;
}
