import { File, Folder, Globe, X } from "lucide-react";
import type { DragEvent } from "react";
import { isSafeExternalUrl } from "../../../../../shared/external-url";
import type { ComposerAttachment } from "../../../desktop/types";
import { cn } from "../../../utils/cn";
import {
  getAttachmentDisplayLabel,
  getOpenAttachmentLabel,
  openComposerAttachment,
} from "./composer-file-picker-utils";

type ComposerFilePickerAttachmentsPanelProps = {
  attachments: ComposerAttachment[];
  draggedAttachments: ComposerAttachment[];
  dropActive: boolean;
  onDragActiveChange: (active: boolean) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onRemoveAttachment: (attachmentPath: string) => void;
};

function getOpenAttachmentIcon(attachment: ComposerAttachment) {
  if (isSafeExternalUrl(attachment.path)) {
    return <Globe size={11} className="block -translate-y-px" />;
  }

  return attachment.kind === "directory" ? (
    <Folder size={11} className="block -translate-y-px" />
  ) : (
    <File size={11} className="block -translate-y-px" />
  );
}

export function ComposerFilePickerAttachmentsPanel({
  attachments,
  draggedAttachments,
  dropActive,
  onDragActiveChange,
  onDrop,
  onRemoveAttachment,
}: ComposerFilePickerAttachmentsPanelProps) {
  return (
    <div
      className={cn(
        "min-h-0 overflow-x-hidden overflow-y-auto border-r border-[rgba(169,178,215,0.08)] bg-[rgba(255,255,255,0.015)] py-2 pr-0 pl-2",
        dropActive && "bg-[rgba(255,255,255,0.04)]",
      )}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        onDragActiveChange(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          onDragActiveChange(false);
        }
      }}
      onDrop={onDrop}
    >
      <div className="grid min-h-full content-start gap-0">
        {attachments.length > 0 ? (
          attachments.map((attachment) => (
            <div
              key={attachment.path}
              className="flex h-5 items-center gap-1 rounded-sm border border-transparent bg-transparent px-1.5 text-[10.5px] text-[color:var(--text)] transition-colors hover:border-[rgba(169,178,215,0.08)] hover:bg-[rgba(255,255,255,0.04)]"
              title={attachment.path}
            >
              <button
                type="button"
                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded p-0 text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)]"
                onClick={() => void openComposerAttachment(attachment)}
                aria-label={getOpenAttachmentLabel(attachment)}
              >
                {getOpenAttachmentIcon(attachment)}
              </button>
              <span className="min-w-0 max-w-[20ch] flex-1 truncate leading-none">
                {getAttachmentDisplayLabel(attachment)}
              </span>
              <button
                type="button"
                className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded p-0 text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)]"
                onClick={() => onRemoveAttachment(attachment.path)}
                aria-label={`Remove ${attachment.name}`}
              >
                <X size={11} className="block -translate-y-px" />
              </button>
            </div>
          ))
        ) : (
          <div
            className={cn(
              "grid min-h-24 place-items-center rounded-xl border border-dashed border-transparent px-3 py-4 text-center text-[12px] text-[color:var(--muted)] transition-colors",
              dropActive &&
                "border-[rgba(169,178,215,0.12)] bg-[rgba(255,255,255,0.05)] text-[color:var(--text)]",
            )}
          >
            {draggedAttachments.length > 0 ? "Drop to attach" : "No attachments yet."}
          </div>
        )}
      </div>
    </div>
  );
}
