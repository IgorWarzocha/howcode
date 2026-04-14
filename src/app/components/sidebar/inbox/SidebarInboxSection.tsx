import { Clock3, ListFilter, Search, SquareTerminal } from "lucide-react";
import { useMemo, useState } from "react";
import type { InboxThread } from "../../../desktop/types";
import { sidebarSearchFieldClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";
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
    <section className="flex min-h-0 flex-1 flex-col gap-2.5">
      <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5">
        <label
          className={cn(
            sidebarSearchFieldClass,
            searchQuery.trim().length > 0 && "bg-[rgba(255,255,255,0.05)] text-[color:var(--text)]",
          )}
        >
          <Search size={14} className="shrink-0 text-[color:var(--muted)]" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search inbox"
            className="w-full min-w-0 bg-transparent p-0 text-[13px] text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted)]"
            aria-label="Search inbox"
          />
        </label>

        <div className="flex items-center gap-1.5">
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
        <div className="min-h-0 overflow-y-auto">
          <div className="grid gap-1">
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
