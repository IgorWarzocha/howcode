import { Archive, FolderOpen, GitBranchPlus, Pencil, X } from "lucide-react";
import type { DesktopAction } from "../../desktop/actions";
import { SurfacePanel } from "../common/SurfacePanel";

type ProjectActionMenuProps = {
  projectId: string;
  onAction: (action: DesktopAction, payload?: Record<string, unknown>) => void;
  onClose: () => void;
};

export function ProjectActionMenu({ projectId, onAction, onClose }: ProjectActionMenuProps) {
  const handleClick = (menuAction: string) => {
    onAction("project.actions", { projectId, menuAction });
    onClose();
  };

  return (
    <SurfacePanel className="absolute top-[calc(100%+6px)] left-4 z-40 grid w-[206px] gap-0.5 rounded-[14px] border-[color:var(--border-strong)] bg-[rgba(45,48,64,0.98)] p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
      {[
        {
          icon: <FolderOpen size={14} />,
          title: "Open in File Manager",
          menuAction: "open-in-file-manager",
        },
        {
          icon: <GitBranchPlus size={14} />,
          title: "Create permanent worktree",
          menuAction: "create-worktree",
        },
        { icon: <Pencil size={14} />, title: "Edit name", menuAction: "edit-name" },
        { icon: <Archive size={14} />, title: "Archive threads", menuAction: "archive-threads" },
        { icon: <X size={14} />, title: "Remove", menuAction: "remove-project" },
      ].map((item) => (
        <button
          key={item.menuAction}
          type="button"
          className="flex items-center gap-2.5 rounded-[11px] border border-transparent px-2.5 py-2 text-left text-[13px] text-[color:var(--text)] transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.04)]"
          onClick={() => handleClick(item.menuAction)}
        >
          <span className="text-[color:var(--muted)]">{item.icon}</span>
          <span className="truncate">{item.title}</span>
        </button>
      ))}
    </SurfacePanel>
  );
}
