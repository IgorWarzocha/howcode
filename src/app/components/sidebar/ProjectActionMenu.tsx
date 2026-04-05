import { Archive, FolderOpen, GitBranchPlus, Pencil, X } from "lucide-react";
import type { RefObject } from "react";
import type { DesktopAction } from "../../desktop/actions";
import { popoverPanelClass } from "../../ui/classes";
import { cn } from "../../utils/cn";
import { MenuItem } from "../common/MenuItem";
import { SurfacePanel } from "../common/SurfacePanel";

type ProjectActionMenuProps = {
  menuId: string;
  projectId: string;
  projectName: string;
  panelRef?: RefObject<HTMLDivElement | null>;
  onAction: (action: DesktopAction, payload?: Record<string, unknown>) => void;
  onClose: () => void;
};

export function ProjectActionMenu({
  menuId,
  projectId,
  projectName,
  panelRef,
  onAction,
  onClose,
}: ProjectActionMenuProps) {
  const handleClick = (action: DesktopAction) => {
    onAction(action, { projectId, projectName });
    onClose();
  };

  return (
    <SurfacePanel
      ref={panelRef}
      id={menuId}
      role="menu"
      aria-label="Project actions"
      className={cn(
        popoverPanelClass,
        "absolute top-[calc(100%+6px)] left-4 z-40 grid w-52 gap-0.5 rounded-2xl p-1.5",
      )}
    >
      {[
        {
          icon: <FolderOpen size={14} />,
          title: "Open in File Manager",
          action: "project.open-in-file-manager" as const,
        },
        {
          icon: <GitBranchPlus size={14} />,
          title: "Create permanent worktree",
          action: "project.create-worktree" as const,
          statusId: "feature:project.action.create-worktree" as const,
        },
        {
          icon: <Pencil size={14} />,
          title: "Edit name",
          action: "project.edit-name" as const,
        },
        {
          icon: <Archive size={14} />,
          title: "Archive threads",
          action: "project.archive-threads" as const,
        },
        {
          icon: <X size={14} />,
          title: "Remove",
          action: "project.remove-project" as const,
        },
      ].map((item) => (
        <MenuItem
          key={item.action}
          icon={item.icon}
          title={item.title}
          statusId={item.statusId}
          className="text-[13px] text-[color:var(--text)]"
          onClick={() => handleClick(item.action)}
          role="menuitem"
        />
      ))}
    </SurfacePanel>
  );
}
