import type { ComposerAttachment } from "./desktop-data-contracts";

function isExternalReference(path: string) {
  return /^https?:\/\//i.test(path);
}

export function buildComposerAttachmentPrompt(attachments: ComposerAttachment[]): string {
  const attachmentPaths = attachments
    .map((attachment) => attachment.path.trim())
    .filter((path) => path.length > 0);

  if (attachmentPaths.length === 0) {
    return "";
  }

  const localPaths = attachmentPaths.filter((path) => !isExternalReference(path));
  const externalReferences = attachmentPaths.filter((path) => isExternalReference(path));
  const sections: string[] = [];

  if (localPaths.length > 0) {
    sections.push(
      `The user attached the following files, please read them:\n${localPaths.map((path) => `- ${path}`).join("\n")}`,
    );
  }

  if (externalReferences.length > 0) {
    sections.push(
      `The user attached the following references, please use them if relevant:\n${externalReferences.map((path) => `- ${path}`).join("\n")}`,
    );
  }

  return sections.join("\n\n");
}
