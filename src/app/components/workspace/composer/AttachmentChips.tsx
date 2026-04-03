import type { ComposerAttachment } from "../../../desktop/types";

type AttachmentChipsProps = {
  attachments: ComposerAttachment[];
  onRemove: (attachmentPath: string) => void;
};

export function AttachmentChips({ attachments, onRemove }: AttachmentChipsProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 px-4 pt-3 pb-1" aria-label="Composer attachments">
      {attachments.map((attachment) => (
        <button
          key={attachment.path}
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(255,255,255,0.04)] px-2.5 py-1 text-[12px] text-[color:var(--text)]"
          onClick={() => onRemove(attachment.path)}
          aria-label={`Remove ${attachment.name}`}
        >
          <span className="text-[color:var(--muted)]">
            {attachment.kind === "image" ? "Image" : "File"}
          </span>
          <span>{attachment.name}</span>
        </button>
      ))}
    </div>
  );
}
