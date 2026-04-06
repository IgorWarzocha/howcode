import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import { ChevronDown, ChevronRight, Folder, Github, MoreHorizontal } from "lucide-react";
import { useEffect, useRef } from "react";
import { getFeatureStatusButtonClass } from "../../../features/feature-status";
import { compactIconButtonClass, sidebarRowClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";

type ProjectRowProps = {
  actionMenuId: string;
  actionMenuOpen: boolean;
  dragHandleProps: {
    attributes: DraggableAttributes;
    listeners: DraggableSyntheticListeners | undefined;
  };
  isActive: boolean;
  isDragging: boolean;
  isExpanded: boolean;
  hasRepoOrigin: boolean;
  name: string;
  renameDraft: string;
  isEditing: boolean;
  threadGroupId: string;
  onCancelEdit: () => void;
  onChangeRenameDraft: (value: string) => void;
  onEdit: () => void;
  onSelect: () => void;
  onSubmitEdit: () => void;
  onToggleActions: () => void;
  onToggleExpanded: () => void;
};

export function ProjectRow({
  actionMenuId,
  actionMenuOpen,
  dragHandleProps,
  isActive,
  isDragging,
  isExpanded,
  hasRepoOrigin,
  name,
  renameDraft,
  isEditing,
  threadGroupId,
  onCancelEdit,
  onChangeRenameDraft,
  onEdit,
  onSelect,
  onSubmitEdit,
  onToggleActions,
  onToggleExpanded,
}: ProjectRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const clickTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isEditing]);

  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current !== null) {
        window.clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  const handleRowClick = () => {
    if (clickTimeoutRef.current !== null) {
      window.clearTimeout(clickTimeoutRef.current);
    }

    clickTimeoutRef.current = window.setTimeout(() => {
      onSelect();
      clickTimeoutRef.current = null;
    }, 180);
  };

  const handleRowDoubleClick = () => {
    if (clickTimeoutRef.current !== null) {
      window.clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }

    onEdit();
  };

  return (
    <div
      className={cn(
        sidebarRowClass,
        "group grid grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-2 px-2 py-0.5",
        (isActive || actionMenuOpen) && "bg-[rgba(183,186,245,0.08)]",
        isDragging && "ring-1 ring-[rgba(183,186,245,0.24)]",
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
        {hasRepoOrigin ? (
          <Github
            size={12}
            className="absolute inset-0 m-auto transition-opacity duration-150 ease-out group-hover:opacity-0 group-focus-within:opacity-0"
          />
        ) : (
          <Folder
            size={12}
            className="absolute inset-0 m-auto transition-opacity duration-150 ease-out group-hover:opacity-0 group-focus-within:opacity-0"
          />
        )}
        {isExpanded ? (
          <ChevronDown
            size={12}
            className="absolute inset-0 m-auto opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 group-focus-within:opacity-100"
          />
        ) : (
          <ChevronRight
            size={12}
            className="absolute inset-0 m-auto opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 group-focus-within:opacity-100"
          />
        )}
      </button>

      {isEditing ? (
        <div className="flex min-h-8 min-w-0 items-center rounded-xl py-1.5 text-left text-[13.5px] leading-5 font-medium text-[color:var(--text)]/92">
          <input
            ref={inputRef}
            value={renameDraft}
            onChange={(event) => onChangeRenameDraft(event.target.value)}
            onBlur={onCancelEdit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSubmitEdit();
                return;
              }

              if (event.key === "Escape") {
                event.preventDefault();
                onCancelEdit();
              }
            }}
            className="w-full min-w-0 bg-transparent p-0 text-[inherit] text-[color:inherit] [font:inherit] outline-none"
            aria-label={`Rename ${name}`}
          />
        </div>
      ) : (
        <button
          type="button"
          className={cn(
            "flex min-h-8 min-w-0 cursor-grab items-center rounded-xl py-1.5 text-left text-[13px] leading-5 text-[color:var(--muted)] transition-colors duration-150 ease-out hover:text-[color:var(--text)] active:cursor-grabbing",
            isActive && "text-[color:var(--text)]",
          )}
          {...dragHandleProps.attributes}
          {...dragHandleProps.listeners}
          onClick={handleRowClick}
          onDoubleClick={handleRowDoubleClick}
          aria-current={isActive ? "page" : undefined}
        >
          <span className="truncate font-medium text-[13.5px] text-[color:var(--text)]/92">
            {name}
          </span>
        </button>
      )}

      <div
        className={cn(
          "flex shrink-0 items-center gap-0.5 pr-0.5 opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 group-focus-within:opacity-100",
          actionMenuOpen && "opacity-100",
          isDragging && "opacity-100",
          isEditing && "opacity-0 pointer-events-none",
        )}
      >
        <button
          type="button"
          className={cn(
            compactIconButtonClass,
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
      </div>
    </div>
  );
}
