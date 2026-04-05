import { useEffect, useId, useRef } from "react";
import { modalPanelClass, panelChromeClass } from "../../ui/classes";
import { cn } from "../../utils/cn";
import { PrimaryButton } from "../common/PrimaryButton";
import { TextButton } from "../common/TextButton";

export type ProjectDialogAction = "project.archive-threads" | "project.remove-project";

export type PendingProjectDialog = {
  action: ProjectDialogAction;
  projectId: string;
  projectName: string;
};

type ProjectActionDialogProps = {
  pendingAction: PendingProjectDialog | null;
  onClose: () => void;
  onConfirm: (payload?: Record<string, unknown>) => Promise<void>;
};

function getDialogCopy(pendingAction: PendingProjectDialog) {
  switch (pendingAction.action) {
    case "project.archive-threads":
      return {
        confirmLabel: "Archive threads",
        description: `Archive all threads from ${pendingAction.projectName} in the app index. Session files stay on disk and can be restored later.`,
        inputLabel: null,
        title: "Archive project threads",
      };
    case "project.remove-project":
      return {
        confirmLabel: "Remove project",
        description: `Hide ${pendingAction.projectName} from the sidebar without deleting its Pi session files from disk.`,
        inputLabel: null,
        title: "Remove project from sidebar",
      };
  }
}

export function ProjectActionDialog({
  pendingAction,
  onClose,
  onConfirm,
}: ProjectActionDialogProps) {
  const titleId = useId();
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!pendingAction) {
      return;
    }

    confirmButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, pendingAction]);

  if (!pendingAction) {
    return null;
  }

  const copy = getDialogCopy(pendingAction);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(8,10,18,0.52)] px-6 py-8 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <dialog
        open
        aria-labelledby={titleId}
        aria-modal="true"
        className={cn(
          panelChromeClass,
          modalPanelClass,
          "flex w-full max-w-[520px] flex-col gap-4 rounded-3xl p-6",
        )}
      >
        <div className="grid gap-1.5">
          <h2 id={titleId} className="text-[18px] font-medium text-[color:var(--text)]">
            {copy.title}
          </h2>
          <p className="m-0 text-[13px] text-[color:var(--muted)]">{copy.description}</p>
        </div>

        <div className="flex items-center justify-end gap-2">
          <TextButton onClick={onClose}>Cancel</TextButton>
          <PrimaryButton ref={confirmButtonRef} onClick={() => onConfirm()}>
            {copy.confirmLabel}
          </PrimaryButton>
        </div>
      </dialog>
    </div>
  );
}
