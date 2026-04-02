import { ChevronDown, ChevronRight, Folder, MoreHorizontal, SquarePen } from "lucide-react";
import { getFeatureStatusButtonClass } from "../../../features/feature-status";
import { cn } from "../../../utils/cn";

type ProjectRowProps = {
  actionMenuId: string;
  actionMenuOpen: boolean;
  isActive: boolean;
  isExpanded: boolean;
  name: string;
  threadGroupId: string;
  onEdit: () => void;
  onSelect: () => void;
  onToggleActions: () => void;
  onToggleExpanded: () => void;
};

export function ProjectRow({
  actionMenuId,
  actionMenuOpen,
  isActive,
  isExpanded,
  name,
  threadGroupId,
  onEdit,
  onSelect,
  onToggleActions,
  onToggleExpanded,
}: ProjectRowProps) {
  return (
    <div
      className={cn(
        "group grid grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-2 rounded-[10px] px-2 py-0.5 transition-colors duration-150 ease-out hover:bg-[rgba(183,186,245,0.08)] focus-within:bg-[rgba(183,186,245,0.08)]",
        (isActive || actionMenuOpen) && "bg-[rgba(183,186,245,0.08)]",
      )}
    >
      <button
        type="button"
        className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-md text-[color:var(--muted)] transition-colors duration-150 ease-out hover:text-[color:var(--text)]"
        onClick={onToggleExpanded}
        aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
        aria-expanded={isExpanded}
        aria-controls={threadGroupId}
      >
        <Folder
          size={14}
          className="absolute transition-opacity duration-150 ease-out group-hover:opacity-0 group-focus-within:opacity-0"
        />
        {isExpanded ? (
          <ChevronDown
            size={14}
            className="absolute opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 group-focus-within:opacity-100"
          />
        ) : (
          <ChevronRight
            size={14}
            className="absolute opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 group-focus-within:opacity-100"
          />
        )}
      </button>

      <button
        type="button"
        className={cn(
          "flex min-h-[32px] min-w-0 items-center rounded-[10px] py-1.5 text-left text-[13px] leading-5 text-[color:var(--muted)] transition-colors duration-150 ease-out hover:text-[color:var(--text)]",
          isActive && "text-[color:var(--text)]",
        )}
        onClick={onSelect}
        aria-current={isActive ? "page" : undefined}
      >
        <span className="truncate font-medium text-[13.5px] text-[color:var(--text)]/92">
          {name}
        </span>
      </button>

      <div
        className={cn(
          "flex shrink-0 items-center gap-0.5 pr-0.5 opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 group-focus-within:opacity-100",
          actionMenuOpen && "opacity-100",
        )}
      >
        <button
          type="button"
          className={cn(
            "inline-flex h-6 w-6 items-center justify-center rounded-md text-[color:var(--muted)] transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.05)] hover:text-[color:var(--text)]",
            actionMenuOpen && "bg-[rgba(255,255,255,0.05)] text-[color:var(--text)]",
            getFeatureStatusButtonClass("feature:sidebar.project.actions"),
          )}
          onClick={onToggleActions}
          aria-label="Project actions"
          aria-haspopup="menu"
          aria-expanded={actionMenuOpen}
          aria-controls={actionMenuId}
        >
          <MoreHorizontal size={14} />
        </button>
        <button
          type="button"
          className={cn(
            "inline-flex h-6 w-6 items-center justify-center rounded-md text-[color:var(--muted)] transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.05)] hover:text-[color:var(--text)]",
            getFeatureStatusButtonClass("feature:sidebar.project.rename"),
          )}
          onClick={onEdit}
          aria-label="Edit project"
        >
          <SquarePen size={13} />
        </button>
      </div>
    </div>
  );
}
