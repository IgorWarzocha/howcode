import { SquareTerminal, X } from "lucide-react";
import { compactIconButtonClass, sidebarRowClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import { ActivitySpinner } from "../../common/ActivitySpinner";

type InboxThreadRowProps = {
  age: string;
  preview: string | null;
  projectName: string;
  running: boolean;
  terminalRunning: boolean;
  selected: boolean;
  title: string;
  unread: boolean;
  onDismiss: () => void;
  onSelect: () => void;
};

export function InboxThreadRow({
  age,
  preview,
  projectName,
  running,
  terminalRunning,
  selected,
  title,
  unread,
  onDismiss,
  onSelect,
}: InboxThreadRowProps) {
  return (
    <div
      className={cn(
        sidebarRowClass,
        "group grid grid-cols-[16px_minmax(0,1fr)_18px] items-start gap-2 px-2.5 py-2",
        selected && "bg-[rgba(183,186,245,0.12)] text-[color:var(--text)]",
      )}
    >
      <div className="flex h-5 items-center justify-center pt-0.5">
        {running ? (
          <ActivitySpinner className="h-3.5 w-3.5 text-[color:var(--text)]" />
        ) : unread ? (
          <span className="h-2 w-2 rounded-full bg-[rgba(183,186,245,0.95)]" />
        ) : null}
      </div>

      <button type="button" className="grid min-w-0 gap-1 text-left" onClick={onSelect}>
        <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-[color:var(--muted-2)]">
          <span className="truncate">{projectName}</span>
          <span aria-hidden="true">•</span>
          {terminalRunning ? (
            <span className="inline-flex items-center justify-center text-[color:var(--muted)]">
              <SquareTerminal size={12} />
            </span>
          ) : (
            <span>{age}</span>
          )}
        </div>
        <div
          className={cn(
            "truncate text-[13px] leading-5 text-[color:var(--muted)] transition-colors duration-150 ease-out group-hover:text-[color:var(--text)]",
            unread && "font-medium text-[color:var(--text)]",
            selected && "text-[color:var(--text)]",
          )}
        >
          {title}
        </div>
        <div className="line-clamp-2 text-[12px] leading-4.5 text-[color:var(--muted-2)]">
          {preview ?? (running ? "Working…" : "No final message yet")}
        </div>
      </button>

      <button
        type="button"
        className={cn(
          compactIconButtonClass,
          "mt-0.5 h-4 w-4 border-transparent bg-transparent opacity-0 hover:bg-transparent group-hover:opacity-100 group-focus-within:opacity-100",
          selected && "opacity-100",
        )}
        onClick={onDismiss}
        aria-label="Dismiss inbox item"
      >
        <X size={12} />
      </button>
    </div>
  );
}
