import type { ComposerAttachment } from "../../../desktop/types";

type ResolveFileEntryActivationArgs = {
  attachment: ComposerAttachment;
  currentSelection: ComposerAttachment[];
  isAlreadyAttached: boolean;
};

export function resolveFileEntryActivation({
  attachment,
  currentSelection,
  isAlreadyAttached,
}: ResolveFileEntryActivationArgs) {
  if (isAlreadyAttached) {
    return { type: "noop" } as const;
  }

  const isSelected = currentSelection.some(
    (currentAttachment) => currentAttachment.path === attachment.path,
  );

  if (!isSelected) {
    return { type: "toggle", attachment } as const;
  }

  return {
    type: "attach",
    attachments: currentSelection.length > 0 ? currentSelection : [attachment],
  } as const;
}
