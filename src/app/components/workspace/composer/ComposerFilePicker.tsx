import { Check, ChevronLeft, File, Folder, Globe, Home, Search, X } from "lucide-react";
import { type DragEvent, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import {
  isSafeExternalUrl,
  normalizeComposerAttachments,
} from "../../../../../shared/composer-attachments";
import type { ComposerAttachment, ComposerFilePickerState } from "../../../desktop/types";
import {
  getAttachmentKindsForPathsQuery,
  getPathForFileQuery,
  openExternalQuery,
  openPathQuery,
} from "../../../query/desktop-query";
import { compactIconButtonClass, popoverPanelClass, settingsInputClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import { SurfacePanel } from "../../common/SurfacePanel";
import { resolveFileEntryActivation } from "./composer-file-picker.helpers";
import { getComposerAttachmentsFromClipboardData } from "./composer-paste-attachments";

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

type RootOption = {
  path: string;
  label: string;
  iconOnly: boolean;
};

type FileEntryButtonProps = {
  attachment: ComposerAttachment;
  isAlreadyAttached: boolean;
  onOpenDirectory?: (path: string) => void;
  onRemoveAttachment: (attachmentPath: string) => void;
  onDragStart: (attachment: ComposerAttachment, event: DragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
  onToggleFile: (attachment: ComposerAttachment) => void;
};

function getAttachmentIcon(attachment: ComposerAttachment, selected: boolean) {
  if (selected) {
    return <Check size={11} />;
  }

  if (attachment.kind === "directory") {
    return <Folder size={11} />;
  }

  return <File size={11} />;
}

function getFolderLabel(folderPath: string) {
  const segments = folderPath.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? folderPath;
}

function getOpenAttachmentLabel(attachment: ComposerAttachment) {
  if (isSafeExternalUrl(attachment.path)) {
    return `Open ${attachment.name} in browser`;
  }

  return `Open ${attachment.name}`;
}

function getOpenAttachmentIcon(attachment: ComposerAttachment) {
  if (isSafeExternalUrl(attachment.path)) {
    return <Globe size={11} />;
  }

  return attachment.kind === "directory" ? <Folder size={11} /> : <File size={11} />;
}

function FileEntryButton({
  attachment,
  isAlreadyAttached,
  onOpenDirectory,
  onRemoveAttachment,
  onDragStart,
  onDragEnd,
  onToggleFile,
}: FileEntryButtonProps) {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <button
      type="button"
      draggable={!isAlreadyAttached}
      className={cn(
        "grid h-8 min-w-0 grid-cols-[12px_minmax(0,1fr)] items-center gap-1 rounded-lg border border-transparent bg-transparent px-2 text-left text-[12px] text-[color:var(--text)] transition-colors",
        isAlreadyAttached && "border-[rgba(169,178,215,0.08)] bg-[rgba(255,255,255,0.05)]",
        isAlreadyAttached &&
          "cursor-default text-[color:var(--muted)] hover:border-transparent hover:bg-transparent",
        !isAlreadyAttached &&
          "hover:border-[rgba(169,178,215,0.08)] hover:bg-[rgba(255,255,255,0.04)]",
        isDragging && "opacity-70",
      )}
      onClick={() => {
        const nextAction = resolveFileEntryActivation({
          attachment,
          isAlreadyAttached,
        });

        if (nextAction.type === "toggle") {
          onToggleFile(nextAction.attachment);
        } else if (nextAction.type === "remove") {
          onRemoveAttachment(nextAction.attachmentPath);
        }
      }}
      onDoubleClick={() => {
        if (attachment.kind === "directory") {
          onOpenDirectory?.(attachment.path);
        }
      }}
      onDragStart={(event) => {
        setIsDragging(true);
        onDragStart(attachment, event);
      }}
      onDragEnd={() => {
        setIsDragging(false);
        onDragEnd();
      }}
      title={attachment.path}
    >
      <span className="inline-flex items-center justify-center text-[color:var(--muted)]">
        {getAttachmentIcon(attachment, isAlreadyAttached)}
      </span>
      <span className="truncate">{attachment.name}</span>
    </button>
  );
}

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

  const openAttachment = async (attachment: ComposerAttachment) => {
    if (isSafeExternalUrl(attachment.path)) {
      if (openExternalQuery) {
        await openExternalQuery(attachment.path);
        return;
      }

      window.open(attachment.path, "_blank", "noopener,noreferrer");
      return;
    }

    await openPathQuery(attachment.path);
  };

  const handleInternalDragStart = (
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

    const dataTransfer = event.dataTransfer;
    try {
      const rawAttachments = getComposerAttachmentsFromClipboardData(dataTransfer, {
        resolveFilePath: (file) => getPathForFileQuery(file as File) ?? null,
      });
      const localPaths = [
        ...new Set(rawAttachments.map((attachment) => attachment.path.trim())),
      ].filter((path) => path.length > 0 && !/^https?:\/\//i.test(path));
      const fallbackKindsByPath = Object.fromEntries(
        rawAttachments
          .filter((attachment) => !/^https?:\/\//i.test(attachment.path.trim()))
          .map((attachment) => [attachment.path, attachment.kind] as const),
      );
      const kindsByPath = (await getAttachmentKindsForPathsQuery(localPaths)) ?? null;
      const externalAttachments = normalizeComposerAttachments(rawAttachments, {
        resolveAttachmentKind: (path) => kindsByPath?.[path] ?? fallbackKindsByPath[path] ?? null,
      });
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
      <div className="flex h-11 min-w-0 items-center justify-between gap-2 overflow-hidden border-b border-[rgba(169,178,215,0.08)] px-3 py-2">
        <div className="flex min-w-0 items-center gap-1 overflow-hidden">
          {picker?.parentPath ? (
            <button
              type="button"
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(255,255,255,0.04)] text-[color:var(--muted)] transition-colors hover:bg-[rgba(255,255,255,0.08)] hover:text-[color:var(--text)]"
              onClick={() => onOpenDirectory(picker.parentPath ?? projectRootPath)}
              aria-label="Go up"
              title="Go up"
            >
              <ChevronLeft size={13} />
            </button>
          ) : null}

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

        <div className="flex shrink-0 items-center gap-1">
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
      </div>

      <div className="grid min-h-0 grid-cols-[minmax(120px,0.25fr)_minmax(0,0.75fr)] overflow-hidden">
        <div
          className={cn(
            "min-h-0 overflow-y-auto border-r border-[rgba(169,178,215,0.08)] bg-[rgba(255,255,255,0.015)] p-2",
            dropActive && "bg-[rgba(255,255,255,0.04)]",
          )}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            setDropActive(true);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setDropActive(false);
            }
          }}
          onDrop={handleDropIntoAttachments}
        >
          <div className="grid min-h-full content-start gap-0">
            {attachments.length > 0 ? (
              attachments.map((attachment) => (
                <div
                  key={attachment.path}
                  className={cn(
                    "flex h-5 items-center gap-0 rounded-sm border border-transparent bg-transparent px-1.5 text-[10.5px] text-[color:var(--text)] transition-colors hover:border-[rgba(169,178,215,0.08)] hover:bg-[rgba(255,255,255,0.04)]",
                  )}
                  title={attachment.path}
                >
                  <span className="min-w-0 max-w-[18ch] flex-1 truncate leading-5">
                    {attachment.name}
                  </span>
                  <button
                    type="button"
                    className={cn(compactIconButtonClass, "h-3.5 w-3.5 shrink-0 rounded")}
                    onClick={() => void openAttachment(attachment)}
                    aria-label={getOpenAttachmentLabel(attachment)}
                    title={getOpenAttachmentLabel(attachment)}
                  >
                    {getOpenAttachmentIcon(attachment)}
                  </button>
                  <button
                    type="button"
                    className={cn(compactIconButtonClass, "h-3.5 w-3.5 shrink-0 rounded")}
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
                  dropActive &&
                    "border-[rgba(169,178,215,0.12)] bg-[rgba(255,255,255,0.05)] text-[color:var(--text)]",
                )}
              >
                {draggedAttachments.length > 0 ? "Drop to attach" : "No attachments yet."}
              </div>
            )}
          </div>
        </div>

        <div className="min-h-0 overflow-x-hidden overflow-y-auto p-2 pt-1">
          {!picker && loading ? (
            <div className="px-2 py-8 text-center text-[12px] text-[color:var(--muted)]">
              Loading files…
            </div>
          ) : filteredEntries.length > 0 ? (
            <div
              className={cn("grid grid-cols-3 gap-1", loading && "pointer-events-none opacity-70")}
            >
              {filteredEntries.map((entry) => {
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
                    onDragStart={handleInternalDragStart}
                    onDragEnd={handleDragEnd}
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

      {errorMessage ? (
        <div className="pointer-events-none absolute right-3 bottom-2 left-3 truncate text-[11px] text-[#f2a7a7]">
          {errorMessage}
        </div>
      ) : null}
    </SurfacePanel>
  );
}
