import { Archive, FolderOpen, GitBranchPlus, Pencil, X } from "lucide-react";
import type { RefObject } from "react";
import type { DesktopAction } from "../../desktop/actions";
import { getFeatureStatusButtonClass, getFeatureStatusMeta } from "../../features/feature-status";
import { cn } from "../../utils/cn";
import { FeatureStatusBadge } from "../common/FeatureStatusBadge";
import { SurfacePanel } from "../common/SurfacePanel";

type ProjectActionMenuProps = {
  menuId: string;
  projectId: string;
  panelRef?: RefObject<HTMLDivElement | null>;
  onAction: (action: DesktopAction, payload?: Record<string, unknown>) => void;
  onClose: () => void;
};

export function ProjectActionMenu({
  menuId,
  projectId,
  panelRef,
  onAction,
  onClose,
}: ProjectActionMenuProps) {
  const handleClick = (menuAction: string) => {
    onAction("project.actions", { projectId, menuAction });
    onClose();
  };

  return (
    <SurfacePanel
      ref={panelRef}
      id={menuId}
      role="menu"
      aria-label="Project actions"
      className="absolute top-[calc(100%+6px)] left-4 z-40 grid w-[206px] gap-0.5 rounded-[14px] border-[color:var(--border-strong)] bg-[rgba(45,48,64,0.98)] p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.28)]"
    >
      {[
        {
          icon: <FolderOpen size={14} />,
          title: "Open in File Manager",
          menuAction: "open-in-file-manager",
          statusId: "feature:project.action.open-file-manager" as const,
        },
        {
          icon: <GitBranchPlus size={14} />,
          title: "Create permanent worktree",
          menuAction: "create-worktree",
          statusId: "feature:project.action.create-worktree" as const,
        },
        {
          icon: <Pencil size={14} />,
          title: "Edit name",
          menuAction: "edit-name",
          statusId: "feature:project.action.edit-name" as const,
        },
        {
          icon: <Archive size={14} />,
          title: "Archive threads",
          menuAction: "archive-threads",
          statusId: "feature:project.action.archive-threads" as const,
        },
        {
          icon: <X size={14} />,
          title: "Remove",
          menuAction: "remove-project",
          statusId: "feature:project.action.remove-project" as const,
        },
      ].map((item) => (
        <button
          key={item.menuAction}
          type="button"
          className={cn(
            "flex items-center gap-2.5 rounded-[11px] border border-transparent px-2.5 py-2 text-left text-[13px] text-[color:var(--text)] transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.04)]",
            getFeatureStatusButtonClass(item.statusId),
          )}
          onClick={() => handleClick(item.menuAction)}
          data-feature-id={item.statusId}
          data-feature-status={getFeatureStatusMeta(item.statusId).status}
          role="menuitem"
        >
          <span className="text-[color:var(--muted)]">{item.icon}</span>
          <span className="truncate">{item.title}</span>
          <FeatureStatusBadge statusId={item.statusId} className="ml-auto" />
        </button>
      ))}
    </SurfacePanel>
  );
}
