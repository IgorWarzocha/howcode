import { ChevronLeft, Home, Search } from "lucide-react";
import type { RefObject } from "react";
import type { ComposerFilePickerState } from "../../../desktop/types";
import { settingsInputClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import type { ComposerFilePickerRootOption } from "./composer-file-picker-utils";

type ComposerFilePickerHeaderProps = {
  picker: ComposerFilePickerState | null;
  projectRootPath: string;
  rootOptions: ComposerFilePickerRootOption[];
  searchExpanded: boolean;
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  onOpenDirectory: (path: string) => void;
  onOpenRoot: (path: string) => void;
  onSearchExpandedChange: (expanded: boolean) => void;
  onSearchQueryChange: (query: string) => void;
};

export function ComposerFilePickerHeader({
  picker,
  projectRootPath,
  rootOptions,
  searchExpanded,
  searchInputRef,
  searchQuery,
  onOpenDirectory,
  onOpenRoot,
  onSearchExpandedChange,
  onSearchQueryChange,
}: ComposerFilePickerHeaderProps) {
  return (
    <div className="flex h-11 min-w-0 items-center justify-between gap-2 overflow-hidden border-b border-[rgba(169,178,215,0.08)] px-3 py-2">
      <div className="flex min-w-0 items-center gap-1 overflow-hidden">
        {picker?.parentPath ? (
          <button
            type="button"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(255,255,255,0.04)] text-[color:var(--muted)] transition-colors hover:bg-[rgba(255,255,255,0.08)] hover:text-[color:var(--text)]"
            onClick={() => onOpenDirectory(picker.parentPath ?? projectRootPath)}
            aria-label="Go up"
            data-tooltip="Go up"
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
            aria-label={`Open ${rootOption.label}`}
            data-tooltip="Open root"
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
              onChange={(event) => onSearchQueryChange(event.target.value)}
              onBlur={() => {
                if (searchQuery.trim().length === 0) {
                  onSearchExpandedChange(false);
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
            onClick={() => onSearchExpandedChange(true)}
            aria-label="Search files"
            data-tooltip="Search files"
          >
            <Search size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
