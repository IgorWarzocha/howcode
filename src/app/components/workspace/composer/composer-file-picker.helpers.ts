import type { ComposerAttachment } from "../../../desktop/types";

type ResolveFileEntryActivationArgs = {
  attachment: ComposerAttachment;
  isAlreadyAttached: boolean;
};

export function resolveFileEntryActivation({
  attachment,
  isAlreadyAttached,
}: ResolveFileEntryActivationArgs) {
  if (isAlreadyAttached) {
    return { type: "remove", attachmentPath: attachment.path } as const;
  }

  return { type: "toggle", attachment } as const;
}
