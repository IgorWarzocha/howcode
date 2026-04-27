import type { ComposerAttachment } from "../../../desktop/types";

const externalUrlPattern = /^https?:\/\//i;

export function buildLocalAttachmentKindLookup(attachments: ComposerAttachment[]) {
  const localPathSet = new Set<string>();
  const fallbackKindsByPath: Record<string, ComposerAttachment["kind"]> = {};

  for (const attachment of attachments) {
    const trimmedPath = attachment.path.trim();
    if (trimmedPath.length === 0 || externalUrlPattern.test(trimmedPath)) {
      continue;
    }

    localPathSet.add(trimmedPath);
    fallbackKindsByPath[attachment.path] = attachment.kind;
    fallbackKindsByPath[trimmedPath] = attachment.kind;
  }

  return {
    fallbackKindsByPath,
    localPaths: [...localPathSet],
  };
}
