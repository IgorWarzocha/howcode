import type { ComposerAttachment } from "../../shared/desktop-contracts";

export function buildComposerAttachmentPrompt(attachments: ComposerAttachment[]): string {
  const attachmentPaths = attachments
    .map((attachment) => attachment.path.trim())
    .filter((path) => path.length > 0);

  if (attachmentPaths.length === 0) {
    return "";
  }

  return `The user attached the following files, please read them:\n${attachmentPaths.map((path) => `- ${path}`).join("\n")}`;
}
