import type { DragEvent } from "react";
import type { ComposerAttachment, ComposerFilePickerState } from "../../../desktop/types";
import { cn } from "../../../utils/cn";
import { FileEntryButton } from "./FileEntryButton";

type ComposerFilePickerFileGridProps = {
  attachedByPath: Set<string>;
  entries: ComposerFilePickerState["entries"];
  loading: boolean;
  picker: ComposerFilePickerState | null;
  searchQuery: string;
  onOpenDirectory: (path: string) => void;
  onRemoveAttachment: (attachmentPath: string) => void;
  onEntryDragStart: (attachment: ComposerAttachment, event: DragEvent<HTMLButtonElement>) => void;
  onEntryDragEnd: () => void;
  onToggleFile: (attachment: ComposerAttachment) => void;
};

export function ComposerFilePickerFileGrid({
  attachedByPath,
  entries,
  loading,
  picker,
  searchQuery,
  onOpenDirectory,
  onRemoveAttachment,
  onEntryDragStart,
  onEntryDragEnd,
  onToggleFile,
}: ComposerFilePickerFileGridProps) {
  return (
    <div className="min-h-0 overflow-x-hidden overflow-y-auto p-2 pt-1">
      {!picker && loading ? (
        <div className="px-2 py-8 text-center text-[12px] text-[color:var(--muted)]">
          Loading files…
        </div>
      ) : entries.length > 0 ? (
        <div className={cn("grid grid-cols-3 gap-1", loading && "pointer-events-none opacity-70")}>
          {entries.map((entry) => {
            const attachment: ComposerAttachment = {
              path: entry.path,
              name: entry.name,
              kind: entry.kind,
            };

            return (
              <FileEntryButton
                key={entry.path}
                attachment={attachment}
                isAlreadyAttached={attachedByPath.has(entry.path)}
                onOpenDirectory={onOpenDirectory}
                onRemoveAttachment={onRemoveAttachment}
                onDragStart={onEntryDragStart}
                onDragEnd={onEntryDragEnd}
                onToggleFile={onToggleFile}
              />
            );
          })}
        </div>
      ) : (
        <div className="px-2 py-8 text-center text-[12px] text-[color:var(--muted)]">
          {searchQuery.trim().length > 0 ? "No matching files." : "No files in this folder."}
        </div>
      )}
    </div>
  );
}
