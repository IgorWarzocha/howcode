import { Archive, FolderOpen, GitBranchPlus } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import type { DesktopAction } from "../../desktop/actions";
import { popoverPanelClass } from "../../ui/classes";
import { cn } from "../../utils/cn";
import { SurfacePanel } from "../common/SurfacePanel";

type ProjectMenuEntry = {
  icon: ReactNode;
  title: string;
  action: DesktopAction;
  className?: string;
};

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

  const items: ProjectMenuEntry[] = [
    {
      icon: <FolderOpen size={14} />,
      title: "File Manager",
      action: "project.open-in-file-manager",
    },
    {
      icon: <GitBranchPlus size={14} />,
      title: "Create Worktree",
      action: "project.create-worktree",
      className:
        "text-[#f2a7a7] hover:text-[#ffd1d1] [&>span:first-child]:text-[#f2a7a7] [&:hover>span:first-child]:text-[#ffd1d1] [&>div>div>span]:text-[#f2a7a7] [&:hover>div>div>span]:text-[#ffd1d1]",
    },
    {
      icon: <Archive size={14} />,
      title: "Archive all",
      action: "project.archive-threads",
    },
  ];

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
          <button
            key={item.action}
            className={cn(
              "grid min-h-8 grid-cols-[16px_minmax(0,1fr)] items-center gap-2 px-2 py-1.5 text-left text-[13px] text-[color:var(--text)] transition-colors hover:bg-[rgba(183,186,245,0.08)]",
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
        ))}
      </div>
    </SurfacePanel>
  );
}
