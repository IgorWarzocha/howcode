import { Check, Clock3, Github, SquareTerminal, Star } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { menuOptionClass, popoverPanelClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";
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
      className={cn(
        popoverPanelClass,
        "motion-popover absolute top-[calc(100%+6px)] right-0 z-30 grid w-44 gap-1 rounded-2xl p-1.5",
      )}
    >
      {items.map((item) => {
        const selected = item.id === filterMode;

        return (
          <button
            key={item.id}
            type="button"
            role="menuitemradio"
            aria-checked={selected}
            className={cn(
              menuOptionClass,
              "grid-cols-[14px_14px_minmax(0,1fr)] text-[color:var(--text)]",
              selected && "bg-[rgba(255,255,255,0.06)]",
            )}
            onClick={() => onSelect(item.id)}
          >
            <span className="inline-flex items-center justify-center text-[color:var(--muted)]">
              {selected ? <Check size={14} /> : null}
            </span>
            <span className="inline-flex items-center justify-center text-[color:var(--muted)]">
              {item.icon}
            </span>
            <span className="truncate text-left">{item.label}</span>
          </button>
        );
      })}
    </SurfacePanel>
  );
}
