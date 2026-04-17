import { Check, Clock3, Github, SquareTerminal, Star } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { SurfacePanel } from "../../common/SurfacePanel";
import type { SidebarProjectsFilterMode } from "./sidebar-projects.helpers";

type SidebarProjectsFilterMenuProps = {
  menuId: string;
  open?: boolean;
  filterMode: SidebarProjectsFilterMode;
  panelRef?: RefObject<HTMLDivElement | null>;
  onSelect: (filterMode: SidebarProjectsFilterMode) => void;
};

const items: Array<{ id: SidebarProjectsFilterMode; label: string; icon: ReactNode }> = [
  { id: "all", label: "All", icon: null },
  { id: "favourites", label: "Favourites", icon: <Star size={14} /> },
  { id: "github", label: "GitHub", icon: <Github size={14} /> },
  { id: "terminal", label: "Terminals", icon: <SquareTerminal size={14} /> },
  { id: "recent", label: "Since launch", icon: <Clock3 size={14} /> },
];

export function SidebarProjectsFilterMenu({
  menuId,
  open = true,
  filterMode,
  panelRef,
  onSelect,
}: SidebarProjectsFilterMenuProps) {
  return (
    <SurfacePanel
      ref={panelRef}
      id={menuId}
      role="menu"
      aria-label="Project filters"
      data-open={open ? "true" : "false"}
      className="sidebar-popover-panel sidebar-filter-menu motion-popover"
    >
      {items.map((item) => {
        const selected = item.id === filterMode;

        return (
          <button
            key={item.id}
            type="button"
            role="menuitemradio"
            aria-checked={selected}
            className="sidebar-filter-option"
            data-selected={selected ? "true" : "false"}
            onClick={() => onSelect(item.id)}
          >
            <span className="sidebar-filter-option__check">
              {selected ? <Check size={14} /> : null}
            </span>
            <span className="sidebar-filter-option__icon">{item.icon}</span>
            <span className="truncate text-left">{item.label}</span>
          </button>
        );
      })}
    </SurfacePanel>
  );
}
