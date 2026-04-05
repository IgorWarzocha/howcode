import { FolderPlus } from "lucide-react";
import { type RefObject, useEffect, useRef } from "react";
import { compactIconButtonClass, popoverPanelClass, settingsInputClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import { SurfacePanel } from "../../common/SurfacePanel";

type SidebarProjectsCreatePopoverProps = {
  menuId: string;
  open: boolean;
  draft: string;
  defaultLocation: string | null;
  initializeGit: boolean;
  busy: boolean;
  errorMessage: string | null;
  panelRef?: RefObject<HTMLDialogElement | null>;
  onChangeDraft: (value: string) => void;
  onCreate: () => void;
  onClose: () => void;
  onOpenSettings: () => void;
};

export function SidebarProjectsCreatePopover({
  menuId,
  open,
  draft,
  defaultLocation,
  initializeGit,
  busy,
  errorMessage,
  panelRef,
  onChangeDraft,
  onCreate,
  onClose,
  onOpenSettings,
}: SidebarProjectsCreatePopoverProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const canCreate = draft.trim().length > 0 && !busy && Boolean(defaultLocation);

  useEffect(() => {
    if (!open) {
      return;
    }

    inputRef.current?.focus();
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <dialog
      ref={panelRef}
      id={menuId}
      open
      aria-label="Create project"
      data-open={open ? "true" : "false"}
      className={cn(
        popoverPanelClass,
        "motion-popover absolute inset-x-0 top-[calc(100%+2px)] z-30 m-0 grid gap-1.5 rounded-xl border-[color:var(--border-strong)] p-1.5",
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_32px] items-center gap-1">
        <input
          ref={inputRef}
          value={draft}
          onChange={(event) => onChangeDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onCreate();
            }

            if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            }
          }}
          className={cn(settingsInputClass, "h-8 border-0 bg-transparent px-2 py-0")}
          placeholder="Project name"
          aria-label="Project name"
        />

        <button
          type="button"
          className={cn(
            compactIconButtonClass,
            "h-8 w-8 rounded-lg border border-transparent",
            canCreate
              ? "bg-[color:var(--accent)] text-[#1a1c26] hover:bg-[color:var(--accent)] hover:text-[#1a1c26]"
              : "opacity-45",
          )}
          onClick={onCreate}
          disabled={!canCreate}
          aria-label={busy ? "Creating project" : "Create project"}
        >
          <FolderPlus size={15} />
        </button>
      </div>

      {errorMessage ? <div className="px-1 text-[12px] text-[#f2a7a7]">{errorMessage}</div> : null}
    </dialog>
  );
}
