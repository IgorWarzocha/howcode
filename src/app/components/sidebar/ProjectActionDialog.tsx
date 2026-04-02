import { useEffect, useId, useRef, useState } from "react";
import { panelChromeClass } from "../../ui/classes";
import { cn } from "../../utils/cn";
import { PrimaryButton } from "../common/PrimaryButton";
import { TextButton } from "../common/TextButton";

export type ProjectDialogAction =
  | "project.edit-name"
  | "project.archive-threads"
  | "project.remove-project";

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
    case "project.edit-name":
      return {
        confirmLabel: "Save name",
        description:
          "This only changes the app display name for this project. Pi session files stay where they are.",
        inputLabel: "Project name",
        title: "Rename project",
      };
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
  const [draftName, setDraftName] = useState("");
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pendingAction) {
      return;
    }

    setDraftName(pendingAction.projectName);

    const focusTarget =
      pendingAction.action === "project.edit-name" ? inputRef.current : confirmButtonRef.current;
    focusTarget?.focus();

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
          "flex w-full max-w-[520px] flex-col gap-4 rounded-[24px] border-[color:var(--border-strong)] bg-[rgba(34,37,50,0.96)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.34)]",
        )}
      >
        <div className="grid gap-1.5">
          <h2 id={titleId} className="text-[18px] font-medium text-[color:var(--text)]">
            {copy.title}
          </h2>
          <p className="m-0 text-[13px] text-[color:var(--muted)]">{copy.description}</p>
        </div>

        {copy.inputLabel ? (
          <label className="grid gap-2 text-[13px] text-[color:var(--muted)]">
            <span>{copy.inputLabel}</span>
            <input
              ref={inputRef}
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && draftName.trim().length > 0) {
                  event.preventDefault();
                  void onConfirm({ projectName: draftName.trim() });
                }
              }}
              className="h-10 rounded-xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.03)] px-3 text-[14px] text-[color:var(--text)] outline-none focus:border-[rgba(183,186,245,0.36)]"
            />
          </label>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <TextButton onClick={onClose}>Cancel</TextButton>
          <PrimaryButton
            ref={confirmButtonRef}
            onClick={() =>
              onConfirm(
                pendingAction.action === "project.edit-name"
                  ? { projectName: draftName.trim() }
                  : undefined,
              )
            }
            disabled={pendingAction.action === "project.edit-name" && draftName.trim().length === 0}
          >
            {copy.confirmLabel}
          </PrimaryButton>
        </div>
      </dialog>
    </div>
  );
}
