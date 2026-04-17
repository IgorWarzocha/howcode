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
      className={cn(
        "group grid min-h-7 w-full grid-cols-[16px_minmax(0,1fr)_28px] items-center gap-2 rounded-xl px-2.5 py-px text-[12.5px] leading-5 text-[color:var(--muted)] transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)] focus-within:bg-[rgba(255,255,255,0.04)] focus-within:text-[color:var(--text)]",
        isSelected &&
          "bg-[rgba(183,186,245,0.12)] text-[color:var(--text)] shadow-[inset_0_0_0_1px_rgba(183,186,245,0.04)]",
      )}
    >
      {running ? (
        <span className="inline-flex h-4 w-4 items-center justify-center text-[color:var(--text)]">
          <ActivitySpinner />
        </span>
      ) : (
        <button
          type="button"
          className={cn(
            "relative inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-md text-[color:var(--muted)] transition-colors duration-150 ease-out hover:text-[color:var(--text)] group-hover:opacity-100 group-focus-within:opacity-100",
            pinned ? "opacity-100 text-[color:var(--text)]" : "opacity-0",
            isSelected && "opacity-100",
          )}
          onClick={onPin}
          aria-label={pinned ? "Unmark favourite" : "Mark favourite"}
          aria-pressed={pinned}
        >
          <Star size={12} className={cn("absolute inset-0 m-auto", pinned && "fill-current")} />
        </button>
      )}

      <button
        type="button"
        className="flex min-w-0 items-center gap-1.5 py-0.5 text-left"
        onClick={onOpen}
        aria-current={isSelected ? "page" : undefined}
      >
        {unread ? (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[rgba(183,186,245,0.95)]" />
        ) : null}
        <span className="truncate">{title}</span>
      </button>

      <span className="relative inline-flex h-6 w-7 shrink-0 items-center text-[color:var(--muted-2)]">
        {terminalRunning ? (
          <span
            className={cn(
              "absolute inset-y-0 right-0.5 inline-flex w-6 items-center justify-center text-[color:var(--muted)] transition-opacity duration-150 ease-out group-hover:opacity-0 group-focus-within:opacity-0",
            )}
          >
            <SquareTerminal size={12} />
          </span>
        ) : (
          <span
            className={cn(
              "absolute inset-y-0 right-0.5 inline-flex w-6 items-center justify-center text-center transition-opacity duration-150 ease-out group-hover:opacity-0 group-focus-within:opacity-0",
            )}
            aria-hidden="true"
          >
            {age}
          </span>
        )}
        <button
          type="button"
          className={cn(
            compactIconButtonClass,
            "absolute inset-y-0 right-0.5 h-6 w-6 border-transparent bg-transparent opacity-0 hover:bg-transparent group-hover:opacity-100 group-focus-within:opacity-100",
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
