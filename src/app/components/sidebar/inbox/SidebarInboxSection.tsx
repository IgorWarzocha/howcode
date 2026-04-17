import { Clock3, ListFilter, Search, SquareTerminal } from "lucide-react";
import { useMemo, useState } from "react";
import type { InboxThread } from "../../../desktop/types";
import { EmptyStateCard } from "../../common/EmptyStateCard";
import { IconButton } from "../../common/IconButton";
import { InboxThreadRow } from "./InboxThreadRow";

type SidebarInboxSectionProps = {
  appLaunchedAtMs: number;
  terminalRunningSessionPaths: ReadonlySet<string>;
  threads: InboxThread[];
  selectedSessionPath: string | null;
  onDismissThread: (thread: InboxThread) => void;
  onSelectThread: (thread: InboxThread) => void;
};

export function SidebarInboxSection({
  appLaunchedAtMs,
  terminalRunningSessionPaths,
  threads,
  selectedSessionPath,
  onDismissThread,
  onSelectThread,
}: SidebarInboxSectionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [filterMode, setFilterMode] = useState<"all" | "terminal" | "recent">("all");

  const cycleFilterMode = () => {
    setFilterMode((current) => {
      if (current === "all") {
        return "terminal";
      }

      if (current === "terminal") {
        return "recent";
      }

      return "all";
    });
  };

  const visibleThreads = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return threads.filter((thread) => {
      if (showUnreadOnly && !thread.unread) {
        return false;
      }

      if (!normalizedQuery) {
        if (filterMode === "terminal") {
          return terminalRunningSessionPaths.has(thread.sessionPath);
        }

        if (filterMode === "recent") {
          return (thread.lastActivityMs ?? 0) >= appLaunchedAtMs;
        }

        return true;
      }

      const matchesQuery = [thread.title, thread.projectName, thread.preview ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);

      if (!matchesQuery) {
        return false;
      }

      if (filterMode === "terminal") {
        return terminalRunningSessionPaths.has(thread.sessionPath);
      }

      if (filterMode === "recent") {
        return (thread.lastActivityMs ?? 0) >= appLaunchedAtMs;
      }

      return true;
    });
  }, [
    appLaunchedAtMs,
    filterMode,
    searchQuery,
    showUnreadOnly,
    terminalRunningSessionPaths,
    threads,
  ]);

  const filterIcon =
    filterMode === "terminal" ? (
      <SquareTerminal size={15} />
    ) : filterMode === "recent" ? (
      <Clock3 size={15} />
    ) : (
      <ListFilter size={15} />
    );
  const filterLabel =
    filterMode === "terminal"
      ? "Show inbox threads with terminals"
      : filterMode === "recent"
        ? "Show inbox threads active since launch"
        : "Filter inbox threads";

  return (
    <section className="sidebar-section">
      <div className="sidebar-toolbar">
        <label
          className="sidebar-search-field"
          data-active={searchQuery.trim().length > 0 ? "true" : "false"}
        >
          <Search size={14} className="sidebar-search-icon" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search inbox"
            className="sidebar-search-input"
            aria-label="Search inbox"
          />
        </label>

        <div className="sidebar-action-group">
          <IconButton
            label={filterLabel}
            icon={filterIcon}
            active={filterMode !== "all"}
            onClick={cycleFilterMode}
          />
          <IconButton
            label="Show unread only"
            icon={<ListFilter size={15} />}
            active={showUnreadOnly}
            onClick={() => setShowUnreadOnly((current) => !current)}
          />
        </div>
      </div>

      {visibleThreads.length > 0 ? (
        <div className="sidebar-scroll-region">
          <div className="sidebar-list">
            {visibleThreads.map((thread) => (
              <InboxThreadRow
                key={thread.sessionPath}
                age={thread.age}
                preview={thread.preview}
                projectName={thread.projectName}
                running={thread.running}
                terminalRunning={terminalRunningSessionPaths.has(thread.sessionPath)}
                selected={selectedSessionPath === thread.sessionPath}
                title={thread.title}
                unread={thread.unread}
                onDismiss={() => onDismissThread(thread)}
                onSelect={() => onSelectThread(thread)}
              />
            ))}
          </div>
        </div>
      ) : (
        <EmptyStateCard className="grid gap-1.5 px-3 py-4 text-center text-[12.5px] text-[color:var(--muted)]">
          <div className="text-[13px] text-[color:var(--text)]">No inbox items</div>
          <div>
            {showUnreadOnly
              ? "No unread threads right now."
              : filterMode === "terminal"
                ? "No inbox threads have a running terminal."
                : filterMode === "recent"
                  ? "No inbox threads have been active since launch."
                  : "Nothing to catch up on yet."}
          </div>
        </EmptyStateCard>
      )}
    </section>
  );
}
