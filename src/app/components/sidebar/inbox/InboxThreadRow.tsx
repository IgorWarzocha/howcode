import { SquareTerminal, X } from "lucide-react";
import { compactIconButtonClass } from "../../../ui/classes";
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
      className="sidebar-row-surface sidebar-inbox-row"
      data-selected={selected ? "true" : "false"}
    >
      <div className="sidebar-inbox-leading">
        {running ? (
          <ActivitySpinner className="h-3.5 w-3.5 text-[color:var(--text)]" />
        ) : unread ? (
          <span className="h-2 w-2 rounded-full bg-[rgba(183,186,245,0.95)]" />
        ) : null}
      </div>

      <button type="button" className="sidebar-inbox-content" onClick={onSelect}>
        <div className="sidebar-inbox-meta">
          <span className="truncate">{projectName}</span>
          <span aria-hidden="true">•</span>
          {terminalRunning ? (
            <span className="sidebar-inbox-terminal">
              <SquareTerminal size={12} />
            </span>
          ) : (
            <span>{age}</span>
          )}
        </div>
        <div className="sidebar-inbox-title" data-unread={unread ? "true" : "false"}>
          {title}
        </div>
        <div className="sidebar-inbox-preview">
          {preview ?? (running ? "Working…" : "No final message yet")}
        </div>
      </button>

      <button
        type="button"
        className={`${compactIconButtonClass} sidebar-inbox-dismiss hover:bg-transparent`}
        onClick={onDismiss}
        data-visible={selected ? "true" : "false"}
        aria-label="Dismiss inbox item"
      >
        <X size={12} />
      </button>
    </div>
  );
}
