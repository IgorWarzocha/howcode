import { FolderPlus } from "lucide-react";
import { type RefObject, useEffect, useRef } from "react";

type SidebarProjectsCreatePopoverProps = {
  menuId: string;
  open: boolean;
  draft: string;
  defaultLocation: string | null;
  busy: boolean;
  errorMessage: string | null;
  panelRef?: RefObject<HTMLDialogElement | null>;
  onChangeDraft: (value: string) => void;
  onCreate: () => void;
  onClose: () => void;
};

export function SidebarProjectsCreatePopover({
  menuId,
  open,
  draft,
  defaultLocation,
  busy,
  errorMessage,
  panelRef,
  onChangeDraft,
  onCreate,
  onClose,
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
      className="sidebar-popover-panel sidebar-project-create-popover motion-popover"
    >
      <div className="sidebar-project-create-row">
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
          className="sidebar-project-create-input"
          placeholder="Project name"
          aria-label="Project name"
        />

        <button
          type="button"
          className="sidebar-project-create-submit"
          onClick={onCreate}
          disabled={!canCreate}
          data-enabled={canCreate ? "true" : "false"}
          aria-label={busy ? "Creating project" : "Create project"}
          data-tooltip={busy ? "Creating project" : "Create project"}
        >
          <FolderPlus size={15} />
        </button>
      </div>

      {errorMessage ? <div className="sidebar-inline-error">{errorMessage}</div> : null}
    </dialog>
  );
}
