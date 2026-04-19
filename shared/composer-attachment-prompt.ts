import type { ComposerAttachment } from "./desktop-data-contracts";

function isExternalReference(path: string) {
  return /^https?:\/\//i.test(path);
}

export function buildComposerAttachmentPrompt(attachments: ComposerAttachment[]): string {
  const normalizedAttachments = attachments
    .map((attachment) => ({ ...attachment, path: attachment.path.trim() }))
    .filter((attachment) => attachment.path.length > 0);

  if (normalizedAttachments.length === 0) {
    return "";
  }

  const localFiles = normalizedAttachments.filter(
    (attachment) => !isExternalReference(attachment.path) && attachment.kind !== "directory",
  );
  const localDirectories = normalizedAttachments.filter(
    (attachment) => !isExternalReference(attachment.path) && attachment.kind === "directory",
  );
  const externalReferences = normalizedAttachments.filter((attachment) =>
    isExternalReference(attachment.path),
  );
  const sections: string[] = [];

  if (localFiles.length > 0) {
    sections.push(
      `The user attached the following files, please read them:\n${localFiles.map((attachment) => `- ${attachment.path}`).join("\n")}`,
    );
  }

  if (localDirectories.length > 0) {
    sections.push(
      `The user attached the following folders, please inspect the relevant files within them if needed:\n${localDirectories.map((attachment) => `- ${attachment.path}`).join("\n")}`,
    );
  }

  if (externalReferences.length > 0) {
    sections.push(
      `The user attached the following references, please use them if relevant:\n${externalReferences.map((attachment) => `- ${attachment.path}`).join("\n")}`,
    );
  }

  return sections.join("\n\n");
}
