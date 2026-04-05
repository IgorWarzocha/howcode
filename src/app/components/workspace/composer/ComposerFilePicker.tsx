import { Check, ChevronLeft, File, Folder } from "lucide-react";
import type { RefObject } from "react";
import type { ComposerAttachment, ComposerFilePickerState } from "../../../desktop/types";
import {
  compactIconButtonClass,
  menuOptionClass,
  popoverPanelClass,
  toolbarButtonClass,
} from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import { SurfacePanel } from "../../common/SurfacePanel";
import { AttachmentChips } from "./AttachmentChips";

type ComposerFilePickerProps = {
  currentSelection: ComposerAttachment[];
  errorMessage: string | null;
  favoriteFolders: string[];
  loading: boolean;
  picker: ComposerFilePickerState | null;
  panelRef: RefObject<HTMLDivElement | null>;
  projectRootPath: string;
  onAttachSelected: () => void;
  onNavigateUp: () => void;
  onOpenRoot: (path: string) => void;
  onOpenDirectory: (path: string) => void;
  onToggleFile: (attachment: ComposerAttachment) => void;
};

function getFolderLabel(folderPath: string) {
  const segments = folderPath.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? folderPath;
}

export function ComposerFilePicker({
  currentSelection,
  errorMessage,
  favoriteFolders,
  loading,
  picker,
  panelRef,
  projectRootPath,
  onAttachSelected,
  onNavigateUp,
  onOpenRoot,
  onOpenDirectory,
  onToggleFile,
}: ComposerFilePickerProps) {
  const selectionByPath = new Set(currentSelection.map((attachment) => attachment.path));
  const hasEntries = (picker?.entries.length ?? 0) > 0;
  const rootOptions = [
    { path: projectRootPath, label: "Project" },
    ...(picker?.homePath ? [{ path: picker.homePath, label: "Home" }] : []),
    ...favoriteFolders.map((folderPath) => ({
      path: folderPath,
      label: getFolderLabel(folderPath),
    })),
  ].filter(
    (option, index, options) =>
      options.findIndex((candidate) => candidate.path === option.path) === index,
  );

  return (
    <SurfacePanel
      ref={panelRef}
      className={cn(
        "absolute right-0 bottom-full left-0 z-[70] grid h-[378px] grid-rows-[44px_minmax(0,1fr)_52px] overflow-hidden rounded-[20px] border-[color:var(--border-strong)] p-0 shadow-[0_18px_40px_rgba(0,0,0,0.28)]",
        popoverPanelClass,
      )}
    >
      <div className="grid h-11 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 border-b border-[rgba(169,178,215,0.08)] px-3 py-2">
        <button
          type="button"
          className={cn(compactIconButtonClass, "shrink-0")}
          onClick={onNavigateUp}
          disabled={!picker?.parentPath}
          aria-label="Go up"
          title="Go up"
        >
          <ChevronLeft size={14} />
        </button>

        <div className="flex min-w-0 flex-wrap gap-1 overflow-hidden">
          {rootOptions.map((rootOption) => (
            <button
              key={rootOption.path}
              type="button"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full bg-[rgba(255,255,255,0.04)] px-2 py-0.5 text-[11px] text-[color:var(--text)] transition-colors",
                picker?.rootPath === rootOption.path
                  ? "bg-[rgba(255,255,255,0.12)]"
                  : "text-[color:var(--muted)] hover:bg-[rgba(255,255,255,0.08)] hover:text-[color:var(--text)]",
              )}
              onClick={() => onOpenRoot(rootOption.path)}
              title={rootOption.path}
            >
              {rootOption.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative min-h-0 overflow-y-auto p-1">
        {!picker && loading ? (
          <div className="px-2 py-8 text-center text-[12px] text-[color:var(--muted)]">
            Loading files…
          </div>
        ) : hasEntries ? (
          <div
            className={cn("grid grid-cols-3 gap-1", loading && "pointer-events-none opacity-70")}
          >
            {picker?.entries.map((entry) => {
              if (entry.kind === "directory") {
                return (
                  <button
                    key={entry.path}
                    type="button"
                    className={cn(
                      menuOptionClass,
                      "min-w-0 grid-cols-[16px_minmax(0,1fr)] text-[color:var(--text)]",
                    )}
                    onDoubleClick={() => onOpenDirectory(entry.path)}
                    title={entry.path}
                  >
                    <span className="inline-flex items-center justify-center text-[color:var(--muted)]">
                      <Folder size={14} />
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

              return (
                <button
                  key={entry.path}
                  type="button"
                  className={cn(
                    menuOptionClass,
                    "min-w-0 grid-cols-[16px_minmax(0,1fr)] text-[color:var(--text)]",
                    selectionByPath.has(entry.path) && "bg-[rgba(255,255,255,0.06)]",
                  )}
                  onClick={() => onToggleFile(attachment)}
                  title={entry.path}
                >
                  <span className="inline-flex items-center justify-center text-[color:var(--muted)]">
                    {selectionByPath.has(entry.path) ? <Check size={14} /> : <File size={14} />}
                  </span>
                  <span className="truncate">{entry.name}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="px-2 py-8 text-center text-[12px] text-[color:var(--muted)]">
            {loading ? "Loading files…" : "No files in this folder."}
          </div>
        )}

        {loading && hasEntries ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 px-3 py-2 text-right text-[11px] text-[color:var(--muted)]">
            Loading…
          </div>
        ) : null}
      </div>

      <div className="grid h-[52px] grid-cols-[auto_minmax(0,1fr)] items-center gap-2 border-t border-[rgba(169,178,215,0.08)] px-3 py-2">
        <button
          type="button"
          className={cn(
            toolbarButtonClass,
            "rounded-full border border-[color:var(--accent)] bg-[color:var(--accent)] px-3 text-[#1a1c26] hover:bg-[color:var(--accent)] hover:text-[#1a1c26] disabled:cursor-not-allowed disabled:opacity-45",
          )}
          onClick={onAttachSelected}
          disabled={currentSelection.length === 0}
        >
          Attach
        </button>
        {currentSelection.length > 0 ? (
          <AttachmentChips
            attachments={currentSelection}
            onRemove={(attachmentPath) => {
              const attachment = currentSelection.find(
                (currentAttachment) => currentAttachment.path === attachmentPath,
              );

              if (attachment) {
                onToggleFile(attachment);
              }
            }}
            className="min-w-0"
            size="compact"
          />
        ) : null}
        {errorMessage ? (
          <div className="min-w-0 truncate text-[12px] text-[#f2a7a7]">{errorMessage}</div>
        ) : null}
      </div>
    </SurfacePanel>
  );
}
