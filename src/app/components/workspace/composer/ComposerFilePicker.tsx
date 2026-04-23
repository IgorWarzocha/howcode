import { type DragEvent, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import type { ComposerAttachment, ComposerFilePickerState } from "../../../desktop/types";
import { popoverPanelClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import { SurfacePanel } from "../../common/SurfacePanel";
import { ComposerFilePickerAttachmentsPanel } from "./ComposerFilePickerAttachmentsPanel";
import { ComposerFilePickerFileGrid } from "./ComposerFilePickerFileGrid";
import { ComposerFilePickerHeader } from "./ComposerFilePickerHeader";
import {
  buildFilePickerRootOptions,
  filterFilePickerEntries,
  getDroppedComposerAttachments,
} from "./composer-file-picker-utils";

type ComposerFilePickerProps = {
  attachments: ComposerAttachment[];
  errorMessage: string | null;
  favoriteFolders: string[];
  loading: boolean;
  picker: ComposerFilePickerState | null;
  panelRef: RefObject<HTMLDivElement | null>;
  projectRootPath: string;
  onAttachAttachments: (
    attachments: ComposerAttachment[],
    options?: { closeMenu?: boolean },
  ) => void;
  onOpenRoot: (path: string) => void;
  onOpenDirectory: (path: string) => void;
  onRemoveAttachment: (attachmentPath: string) => void;
  onToggleFile: (attachment: ComposerAttachment) => void;
};

export function ComposerFilePicker({
  attachments,
  errorMessage,
  favoriteFolders,
  loading,
  picker,
  panelRef,
  projectRootPath,
  onAttachAttachments,
  onOpenRoot,
  onOpenDirectory,
  onRemoveAttachment,
  onToggleFile,
}: ComposerFilePickerProps) {
  const [draggedAttachments, setDraggedAttachments] = useState<ComposerAttachment[]>([]);
  const [dropActive, setDropActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const attachedByPath = useMemo(
    () => new Set(attachments.map((attachment) => attachment.path)),
    [attachments],
  );
  const rootOptions = useMemo(
    () => buildFilePickerRootOptions({ favoriteFolders, picker, projectRootPath }),
    [favoriteFolders, picker, projectRootPath],
  );
  const filteredEntries = useMemo(
    () => filterFilePickerEntries(picker?.entries ?? [], searchQuery),
    [picker?.entries, searchQuery],
  );

  const handleEntryDragStart = (
    attachment: ComposerAttachment,
    event: DragEvent<HTMLButtonElement>,
  ) => {
    const nextDraggedAttachments = [attachment];

    setDraggedAttachments(nextDraggedAttachments);
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(
      "application/x-howcode-attachments",
      JSON.stringify(nextDraggedAttachments.map((candidate) => candidate.path)),
    );
  };

  const handleDragEnd = () => {
    setDraggedAttachments([]);
    setDropActive(false);
  };

  const handleDropIntoAttachments = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    if (draggedAttachments.length > 0) {
      onAttachAttachments(draggedAttachments);
      handleDragEnd();
      return;
    }

    try {
      const externalAttachments = await getDroppedComposerAttachments(event.dataTransfer);
      if (externalAttachments.length > 0) {
        onAttachAttachments(externalAttachments);
      }
    } finally {
      setDropActive(false);
    }
  };

  useEffect(() => {
    if (searchExpanded) {
      searchInputRef.current?.focus();
    }
  }, [searchExpanded]);

  return (
    <SurfacePanel
      ref={panelRef}
      className={cn(
        "absolute right-0 bottom-full left-0 z-[70] grid h-[min(378px,calc(100vh-12rem))] min-h-[220px] grid-rows-[44px_minmax(0,1fr)] overflow-hidden rounded-[20px] border-[color:var(--border-strong)] p-0 shadow-[0_18px_40px_rgba(0,0,0,0.28)]",
        popoverPanelClass,
      )}
    >
      <ComposerFilePickerHeader
        picker={picker}
        projectRootPath={projectRootPath}
        rootOptions={rootOptions}
        searchExpanded={searchExpanded}
        searchInputRef={searchInputRef}
        searchQuery={searchQuery}
        onOpenDirectory={onOpenDirectory}
        onOpenRoot={onOpenRoot}
        onSearchExpandedChange={setSearchExpanded}
        onSearchQueryChange={setSearchQuery}
      />

      <div className="grid min-h-0 grid-cols-[minmax(120px,0.25fr)_minmax(0,0.75fr)] overflow-hidden">
        <ComposerFilePickerAttachmentsPanel
          attachments={attachments}
          draggedAttachments={draggedAttachments}
          dropActive={dropActive}
          onDragActiveChange={setDropActive}
          onDrop={handleDropIntoAttachments}
          onRemoveAttachment={onRemoveAttachment}
        />

        <ComposerFilePickerFileGrid
          attachedByPath={attachedByPath}
          entries={filteredEntries}
          loading={loading}
          picker={picker}
          searchQuery={searchQuery}
          onOpenDirectory={onOpenDirectory}
          onRemoveAttachment={onRemoveAttachment}
          onEntryDragStart={handleEntryDragStart}
          onEntryDragEnd={handleDragEnd}
          onToggleFile={onToggleFile}
        />
      </div>

      {errorMessage ? (
        <div className="pointer-events-none absolute right-3 bottom-2 left-3 truncate text-[11px] text-[#f2a7a7]">
          {errorMessage}
        </div>
      ) : null}
    </SurfacePanel>
  );
}
