import { Check, Folder } from "lucide-react";
import type { RefObject } from "react";
import type { Project } from "../../../types";
import { HeaderMenu } from "./HeaderMenu";

type ProjectSwitchMenuProps = {
  menuId: string;
  panelRef: RefObject<HTMLDivElement | null>;
  projects: Project[];
  selectedProjectId: string;
  onSelectProject: (projectId: string) => void;
};

export function ProjectSwitchMenu({
  menuId,
  panelRef,
  projects,
  selectedProjectId,
  onSelectProject,
}: ProjectSwitchMenuProps) {
  return (
    <HeaderMenu ariaLabel="Switch project" menuId={menuId} panelRef={panelRef}>
      {projects.map((project) => {
        const isSelected = project.id === selectedProjectId;

        return (
          <button
            key={project.id}
            type="button"
            role="menuitemradio"
            aria-checked={isSelected}
            className="grid grid-cols-[16px_16px_minmax(0,1fr)] items-center gap-2 rounded-[11px] px-2.5 py-2 text-left text-[13px] text-[color:var(--text)] transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.04)]"
            onClick={() => onSelectProject(project.id)}
          >
            <span className="inline-flex items-center justify-center text-[color:var(--accent)]">
              {isSelected ? <Check size={14} /> : null}
            </span>
            <span className="text-[color:var(--muted)]">
              <Folder size={14} />
            </span>
            <span className="min-w-0 truncate">{project.name}</span>
          </button>
        );
      })}
    </HeaderMenu>
  );
}
