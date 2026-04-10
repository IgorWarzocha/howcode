import { ListFilter, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { InboxThread } from "../../../desktop/types";
import { sidebarSearchFieldClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import { EmptyStateCard } from "../../common/EmptyStateCard";
import { IconButton } from "../../common/IconButton";
import { InboxThreadRow } from "./InboxThreadRow";

type SidebarInboxSectionProps = {
  threads: InboxThread[];
  selectedSessionPath: string | null;
  onDismissThread: (thread: InboxThread) => void;
  onSelectThread: (thread: InboxThread) => void;
};

export function SidebarInboxSection({
  threads,
  selectedSessionPath,
  onDismissThread,
  onSelectThread,
}: SidebarInboxSectionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const visibleThreads = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return threads.filter((thread) => {
      if (showUnreadOnly && !thread.unread) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [thread.title, thread.projectName, thread.preview ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [searchQuery, showUnreadOnly, threads]);

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

        <IconButton
          label="Show unread only"
          icon={<ListFilter size={15} />}
          active={showUnreadOnly}
          onClick={() => setShowUnreadOnly((current) => !current)}
        />
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
            {showUnreadOnly ? "No unread threads right now." : "Nothing to catch up on yet."}
          </div>
        </EmptyStateCard>
      )}
    </section>
  );
}
