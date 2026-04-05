import type { ComposerAttachment } from "../../../desktop/types";
import { cn } from "../../../utils/cn";

type AttachmentChipsProps = {
  attachments: ComposerAttachment[];
  onRemove: (attachmentPath: string) => void;
  className?: string;
  size?: "default" | "compact";
};

export function AttachmentChips({
  attachments,
  onRemove,
  className,
  size = "default",
}: AttachmentChipsProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)} aria-label="Composer attachments">
      {attachments.map((attachment) => (
        <button
          key={attachment.path}
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full bg-[rgba(255,255,255,0.04)] text-[color:var(--text)]",
            size === "compact" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-[12px]",
          )}
          onClick={() => onRemove(attachment.path)}
          aria-label={`Remove ${attachment.name}`}
          title={attachment.path}
        >
          <span>{attachment.name}</span>
        </button>
      ))}
    </div>
  );
}
