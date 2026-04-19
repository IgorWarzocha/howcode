import {
  DndContext,
  PointerSensor,
  type DragEndEvent,
  type DragStartEvent,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Check, File, Folder, FolderOpen, Globe, Home, Search, X } from "lucide-react";
import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { isSafeExternalUrl } from "../../../../../shared/composer-attachments";
import type { ComposerAttachment, ComposerFilePickerState } from "../../../desktop/types";
import { compactIconButtonClass, popoverPanelClass, settingsInputClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import { SurfacePanel } from "../../common/SurfacePanel";

type ComposerFilePickerProps = {
  attachments: ComposerAttachment[];
  currentSelection: ComposerAttachment[];
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

type RootOption = {
  path: string;
  label: string;
  iconOnly: boolean;
};

type DraggableFileEntryProps = {
  attachment: ComposerAttachment;
  attachmentsToAttach: ComposerAttachment[];
  isAlreadyAttached: boolean;
  isSelected: boolean;
  onToggleFile: (attachment: ComposerAttachment) => void;
};

const attachmentDropZoneId = "composer-picker-attached-dropzone";

function getFolderLabel(folderPath: string) {
  const segments = folderPath.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? folderPath;
}

function getParentFolderPath(filePath: string) {
  const normalizedPath = filePath.replace(/[\\/]+$/, "");
  const match = normalizedPath.match(/^(.*)[\\/][^\\/]+$/);
  const parentPath = match?.[1] ?? null;

  if (!parentPath) {
    return null;
  }

  if (/^[A-Za-z]:$/.test(parentPath)) {
    return `${parentPath}\\`;
  }

  return parentPath || "/";
}

function DraggableFileEntry({
  attachment,
  attachmentsToAttach,
  isAlreadyAttached,
  isSelected,
  onToggleFile,
}: DraggableFileEntryProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `composer-picker-entry:${attachment.path}`,
    disabled: isAlreadyAttached,
    data: { attachmentsToAttach },
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      className={cn(
        "grid h-8 min-w-0 grid-cols-[12px_minmax(0,1fr)] items-center gap-1 rounded-lg border border-transparent bg-transparent px-2 text-left text-[12px] text-[color:var(--text)] transition-colors",
        isSelected && "border-[rgba(169,178,215,0.08)] bg-[rgba(255,255,255,0.05)]",
        isAlreadyAttached &&
          "cursor-default text-[color:var(--muted)] hover:border-transparent hover:bg-transparent",
        !isAlreadyAttached &&
          "hover:border-[rgba(169,178,215,0.08)] hover:bg-[rgba(255,255,255,0.04)]",
        isDragging && "opacity-70",
      )}
      style={{ transform: CSS.Translate.toString(transform) }}
      onClick={() => {
        if (!isAlreadyAttached) {
          onToggleFile(attachment);
        }
      }}
      title={attachment.path}
    >
      <span className="inline-flex items-center justify-center text-[color:var(--muted)]">
        {isAlreadyAttached || isSelected ? <Check size={11} /> : <File size={11} />}
      </span>
      <span className="truncate">{attachment.name}</span>
    </button>
  );
}

export function ComposerFilePicker({
  attachments,
  currentSelection,
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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectionByPath = useMemo(
    () => new Set(currentSelection.map((attachment) => attachment.path)),
    [currentSelection],
  );
  const attachedByPath = useMemo(
    () => new Set(attachments.map((attachment) => attachment.path)),
    [attachments],
  );

  const rootOptions: RootOption[] = [
    ...(picker?.homePath ? [{ path: picker.homePath, label: "Home", iconOnly: true }] : []),
    { path: projectRootPath, label: "Project", iconOnly: false },
    ...favoriteFolders.map((folderPath) => ({
      path: folderPath,
      label: getFolderLabel(folderPath),
      iconOnly: false,
    })),
  ].filter(
    (option, index, options) =>
      options.findIndex((candidate) => candidate.path === option.path) === index,
  );

  const filteredEntries = useMemo(() => {
    const entries = picker?.entries ?? [];
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return entries;
    }

    return entries.filter((entry) => entry.name.toLowerCase().includes(query));
  }, [picker?.entries, searchQuery]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const { isOver, setNodeRef: setDropZoneRef } = useDroppable({
    id: attachmentDropZoneId,
  });

  const openAttachment = async (attachment: ComposerAttachment) => {
    if (isSafeExternalUrl(attachment.path)) {
      if (window.piDesktop?.openExternal) {
        await window.piDesktop.openExternal(attachment.path);
        return;
      }

      window.open(attachment.path, "_blank", "noopener,noreferrer");
      return;
    }

    const folderPath = getParentFolderPath(attachment.path) ?? attachment.path;
    await window.piDesktop?.openPath?.(folderPath);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const nextDraggedAttachments = Array.isArray(event.active.data.current?.attachmentsToAttach)
      ? (event.active.data.current.attachmentsToAttach as ComposerAttachment[])
      : [];
    setDraggedAttachments(nextDraggedAttachments);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (event.over?.id === attachmentDropZoneId && draggedAttachments.length > 0) {
      onAttachAttachments(draggedAttachments);
    }

    setDraggedAttachments([]);
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
        "absolute right-0 bottom-full left-0 z-[70] grid h-[378px] grid-rows-[44px_minmax(0,1fr)] overflow-hidden rounded-[20px] border-[color:var(--border-strong)] p-0 shadow-[0_18px_40px_rgba(0,0,0,0.28)]",
        popoverPanelClass,
      )}
    >
      <div className="flex h-11 min-w-0 items-center justify-between gap-2 overflow-hidden border-b border-[rgba(169,178,215,0.08)] px-3 py-2">
        <div className="flex min-w-0 items-center gap-1 overflow-hidden">
          {rootOptions.map((rootOption) => (
            <button
              key={rootOption.path}
              type="button"
              className={cn(
                rootOption.iconOnly
                  ? "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(255,255,255,0.04)] text-[color:var(--text)] transition-colors"
                  : "inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-[rgba(255,255,255,0.04)] px-2 text-[11px] text-[color:var(--text)] transition-colors",
                picker?.rootPath === rootOption.path
                  ? "bg-[rgba(255,255,255,0.12)]"
                  : "text-[color:var(--muted)] hover:bg-[rgba(255,255,255,0.08)] hover:text-[color:var(--text)]",
              )}
              onClick={() => onOpenRoot(rootOption.path)}
              title={rootOption.path}
            >
              {rootOption.iconOnly ? <Home size={13} /> : rootOption.label}
            </button>
          ))}
        </div>

        {searchExpanded || searchQuery.length > 0 ? (
          <label className="relative shrink-0">
            <Search
              size={12}
              className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-[color:var(--muted)]"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onBlur={() => {
                if (searchQuery.trim().length === 0) {
                  setSearchExpanded(false);
                }
              }}
              placeholder="Search files"
              className={cn(
                settingsInputClass,
                "h-6 w-40 rounded-full border-transparent bg-[rgba(255,255,255,0.04)] pr-2 pl-7 text-[11px]",
              )}
              aria-label="Search files"
            />
          </label>
        ) : (
          <button
            type="button"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(255,255,255,0.04)] text-[color:var(--muted)] transition-colors hover:bg-[rgba(255,255,255,0.08)] hover:text-[color:var(--text)]"
            onClick={() => setSearchExpanded(true)}
            aria-label="Search files"
            title="Search files"
          >
            <Search size={13} />
          </button>
        )}
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDraggedAttachments([])}
      >
        <div className="grid min-h-0 grid-cols-[minmax(220px,0.33fr)_minmax(0,0.67fr)] overflow-hidden">
          <div
            ref={setDropZoneRef}
            className={cn(
              "min-h-0 border-r border-[rgba(169,178,215,0.08)] bg-[rgba(255,255,255,0.015)] p-2",
              isOver && "bg-[rgba(255,255,255,0.04)]",
            )}
          >
            <div className="grid min-h-full content-start gap-1">
              {attachments.length > 0 ? (
                attachments.map((attachment) => (
                  <div
                    key={attachment.path}
                    className={cn(
                      "grid h-8 grid-cols-[12px_minmax(0,1fr)_18px_18px] items-center gap-1 rounded-lg border border-transparent bg-transparent px-2 text-[12px] text-[color:var(--text)] transition-colors hover:border-[rgba(169,178,215,0.08)] hover:bg-[rgba(255,255,255,0.04)]",
                    )}
                    title={attachment.path}
                  >
                    <span className="inline-flex items-center justify-center text-[color:var(--muted)]">
                      <File size={11} />
                    </span>
                    <span className="truncate">{attachment.name}</span>
                    <button
                      type="button"
                      className={cn(compactIconButtonClass, "h-[18px] w-[18px] rounded")}
                      onClick={() => void openAttachment(attachment)}
                      aria-label={
                        isSafeExternalUrl(attachment.path)
                          ? `Open ${attachment.name} in browser`
                          : `Open folder for ${attachment.name}`
                      }
                      title={
                        isSafeExternalUrl(attachment.path)
                          ? `Open ${attachment.name} in browser`
                          : `Open folder for ${attachment.name}`
                      }
                    >
                      {isSafeExternalUrl(attachment.path) ? (
                        <Globe size={11} />
                      ) : (
                        <FolderOpen size={11} />
                      )}
                    </button>
                    <button
                      type="button"
                      className={cn(compactIconButtonClass, "h-[18px] w-[18px] rounded")}
                      onClick={() => onRemoveAttachment(attachment.path)}
                      aria-label={`Remove ${attachment.name}`}
                      title={`Remove ${attachment.name}`}
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))
              ) : (
                <div
                  className={cn(
                    "grid min-h-24 place-items-center rounded-xl border border-dashed border-transparent px-3 py-4 text-center text-[12px] text-[color:var(--muted)] transition-colors",
                    isOver &&
                      "border-[rgba(169,178,215,0.12)] bg-[rgba(255,255,255,0.05)] text-[color:var(--text)]",
                  )}
                >
                  {draggedAttachments.length > 0 ? "Drop to attach" : "No attachments yet."}
                </div>
              )}
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto p-2 pt-1">
            {!picker && loading ? (
              <div className="px-2 py-8 text-center text-[12px] text-[color:var(--muted)]">
                Loading files…
              </div>
            ) : filteredEntries.length > 0 ? (
              <div
                className={cn(
                  "grid grid-cols-2 gap-1",
                  loading && "pointer-events-none opacity-70",
                )}
              >
                {filteredEntries.map((entry) => {
                  if (entry.kind === "directory") {
                    return (
                      <button
                        key={entry.path}
                        type="button"
                        className={cn(
                          "grid h-8 min-w-0 grid-cols-[12px_minmax(0,1fr)] items-center gap-1 rounded-lg border border-transparent bg-transparent px-2 text-left text-[12px] text-[color:var(--text)] transition-colors hover:border-[rgba(169,178,215,0.08)] hover:bg-[rgba(255,255,255,0.04)]",
                        )}
                        onDoubleClick={() => onOpenDirectory(entry.path)}
                        title={entry.path}
                      >
                        <span className="inline-flex items-center justify-center text-[color:var(--muted)]">
                          <Folder size={11} />
                        </span>
                        <span className="truncate">{entry.name}</span>
                      </button>
                    );
                  }

                  const attachment: ComposerAttachment = {
                    path: entry.path,
                    name: entry.name,
                    kind: entry.kind,
                  };
                  const isAlreadyAttached = attachedByPath.has(entry.path);
                  const attachmentsToAttach =
                    selectionByPath.has(entry.path) && currentSelection.length > 0
                      ? currentSelection
                      : [attachment];

                  return (
                    <DraggableFileEntry
                      key={entry.path}
                      attachment={attachment}
                      attachmentsToAttach={attachmentsToAttach}
                      isAlreadyAttached={isAlreadyAttached}
                      isSelected={selectionByPath.has(entry.path)}
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
        </div>
      </DndContext>

      {errorMessage ? (
        <div className="pointer-events-none absolute right-3 bottom-2 left-3 truncate text-[11px] text-[#f2a7a7]">
          {errorMessage}
        </div>
      ) : null}
    </SurfacePanel>
  );
}
