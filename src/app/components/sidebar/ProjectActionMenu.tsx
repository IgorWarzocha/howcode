import { Archive, FolderOpen, Star, Trash2 } from "lucide-react";
import { type ReactNode, type RefObject, useRef, useState } from "react";
import type { DesktopAction } from "../../desktop/actions";
import type { DesktopActionInvoker } from "../../desktop/types";
import { popoverPanelClass } from "../../ui/classes";
import { cn } from "../../utils/cn";
import { ConfirmPopover } from "../common/ConfirmPopover";
import { SurfacePanel } from "../common/SurfacePanel";

type ProjectMenuEntry = {
  icon: ReactNode;
  title: string;
  action: DesktopAction;
  className?: string;
};

type DangerousProjectAction = Extract<
  DesktopAction,
  "project.archive-threads" | "project.remove-project"
>;

type ProjectActionMenuProps = {
  menuId: string;
  projectId: string;
  projectName: string;
  canDelete?: boolean;
  pinned?: boolean;
  panelRef?: RefObject<HTMLDivElement | null>;
  onAction: DesktopActionInvoker;
  onClose: () => void;
};

export function ProjectActionMenu({
  menuId,
  projectId,
  projectName,
  canDelete = true,
  pinned = false,
  panelRef,
  onAction,
  onClose,
}: ProjectActionMenuProps) {
  const [confirmAction, setConfirmAction] = useState<DangerousProjectAction | null>(null);
  const archiveButtonRef = useRef<HTMLButtonElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);

  const handleClick = (action: DesktopAction) => {
    if (action === "project.archive-threads" || action === "project.remove-project") {
      setConfirmAction((current) => (current === action ? null : action));
      return;
    }

    setConfirmAction(null);
    onAction(action, { projectId, projectName });
    onClose();
  };

  const items: ProjectMenuEntry[] = [
    {
      icon: <FolderOpen size={14} />,
      title: "File Manager",
      action: "project.open-in-file-manager",
    },
    {
      icon: <Star size={14} className={pinned ? "fill-current" : undefined} />,
      title: pinned ? "Unmark Favourite" : "Mark Favourite",
      action: "project.pin",
    },
    // {
    //   icon: <GitBranchPlus size={14} />,
    //   title: "Create Worktree",
    //   action: "project.create-worktree",
    //   className:
    //     "text-[#f2a7a7] hover:text-[#ffd1d1] [&>span:first-child]:text-[#f2a7a7] [&:hover>span:first-child]:text-[#ffd1d1] [&>div>div>span]:text-[#f2a7a7] [&:hover>div>div>span]:text-[#ffd1d1]",
    // },
    {
      icon: <Archive size={14} />,
      title: "Archive all",
      action: "project.archive-threads",
    },
  ];

  if (canDelete) {
    items.push({
      icon: <Trash2 size={14} />,
      title: "Delete project",
      action: "project.remove-project",
      className:
        "text-[#f2a7a7] hover:text-[#ffd1d1] [&>span:first-child]:text-[#f2a7a7] [&:hover>span:first-child]:text-[#ffd1d1]",
    });
  }

  return (
    <SurfacePanel
      ref={panelRef}
      id={menuId}
      role="menu"
      aria-label="Project actions"
      className={cn(
        popoverPanelClass,
        "absolute inset-x-0 top-[calc(100%+2px)] z-40 overflow-hidden rounded-[18px] border-[color:var(--border-strong)] p-0",
      )}
    >
      <div className="grid">
        {items.map((item, index) => (
          <div key={item.action} className="relative">
            <button
              ref={
                item.action === "project.archive-threads"
                  ? archiveButtonRef
                  : item.action === "project.remove-project"
                    ? deleteButtonRef
                    : undefined
              }
              className={cn(
                "grid min-h-8 w-full grid-cols-[16px_minmax(0,1fr)] items-center gap-2 px-2 py-1.5 text-left text-[13px] text-[color:var(--text)] transition-colors hover:bg-[rgba(183,186,245,0.08)]",
                index > 0 && "border-t border-[rgba(169,178,215,0.08)]",
                item.className,
              )}
              onClick={() => handleClick(item.action)}
              role="menuitem"
              type="button"
            >
              <span className="inline-flex items-center justify-center text-[color:var(--muted)]">
                {item.icon}
              </span>
              <span className="truncate text-left">{item.title}</span>
            </button>

            {item.action === "project.archive-threads" ||
            item.action === "project.remove-project" ? (
              <ConfirmPopover
                open={confirmAction === item.action}
                anchorRef={
                  item.action === "project.archive-threads" ? archiveButtonRef : deleteButtonRef
                }
                message="Click to confirm"
                confirmLabel={item.action === "project.archive-threads" ? "Archive" : "Delete"}
                onClose={() => setConfirmAction(null)}
                onConfirm={() => {
                  setConfirmAction(null);
                  onAction(item.action, { projectId, projectName });
                  onClose();
                }}
              />
            ) : null}
          </div>
        ))}
      </div>
    </SurfacePanel>
  );
}
