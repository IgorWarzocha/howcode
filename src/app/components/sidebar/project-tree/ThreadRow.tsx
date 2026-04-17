import { Archive, SquareTerminal, Star } from "lucide-react";
import { compactIconButtonClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import { ActivitySpinner } from "../../common/ActivitySpinner";

type ThreadRowProps = {
  age: string;
  pinned?: boolean;
  running?: boolean;
  terminalRunning?: boolean;
  unread?: boolean;
  isSelected: boolean;
  title: string;
  onArchive: () => void;
  onOpen: () => void;
  onPin: () => void;
};

export function ThreadRow({
  age,
  pinned = false,
  running = false,
  terminalRunning = false,
  unread = false,
  isSelected,
  title,
  onArchive,
  onOpen,
  onPin,
}: ThreadRowProps) {
  return (
    <div
      className="sidebar-row-surface sidebar-thread-row"
      data-selected={isSelected ? "true" : "false"}
    >
      {running ? (
        <span className="sidebar-thread-leading-icon">
          <ActivitySpinner />
        </span>
      ) : unread ? (
        <span className="sidebar-thread-pin-indicator" aria-hidden="true" />
      ) : (
        <button
          type="button"
          className="sidebar-thread-pin"
          onClick={onPin}
          data-pinned={pinned ? "true" : "false"}
          data-selected={isSelected ? "true" : "false"}
          aria-label={pinned ? "Unmark favourite" : "Mark favourite"}
          aria-pressed={pinned}
        >
          <Star size={12} className={cn("absolute inset-0 m-auto", pinned && "fill-current")} />
        </button>
      )}

      <button
        type="button"
        className="sidebar-thread-button"
        onClick={onOpen}
        aria-current={isSelected ? "page" : undefined}
      >
        <span className="truncate">{title}</span>
      </button>

      <span className="sidebar-thread-meta-slot">
        {terminalRunning ? (
          <span className="sidebar-thread-meta-value">
            <SquareTerminal size={12} />
          </span>
        ) : (
          <span className="sidebar-thread-meta-value" aria-hidden="true">
            {age}
          </span>
        )}
        <button
          type="button"
          className={cn(
            compactIconButtonClass,
            "sidebar-thread-meta-action border-transparent bg-transparent hover:bg-transparent",
          )}
          onClick={onArchive}
          aria-label="Archive thread"
        >
          <Archive size={12} />
        </button>
      </span>
    </div>
  );
}
