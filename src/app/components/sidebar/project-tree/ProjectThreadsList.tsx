import { Archive, ChevronDown, ChevronRight } from "lucide-react";
import type { DesktopActionInvoker } from "../../../desktop/types";
import { useAnimatedPresence } from "../../../hooks/useAnimatedPresence";
import type { Project, View } from "../../../types";
import { compactIconButtonClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import { Tooltip } from "../../common/Tooltip";
import { EmptyThreadsState } from "./EmptyThreadsState";
import { ThreadRow } from "./ThreadRow";

const OLD_THREAD_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

type ProjectThreadsListProps = {
  activeView: View;
  expandedByUser: boolean;
  isExpanded: boolean;
  project: Project;
  revealOldThreads: boolean;
  selectedThreadId: string | null;
  terminalRunningSessionPaths: ReadonlySet<string>;
  threadGroupId: string;
  onAction: DesktopActionInvoker;
  onCloseProjectMenu: () => void;
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void;
  onToggleOldThreads: (currentlyExpanded: boolean) => void;
};

function partitionProjectThreads(project: Project) {
  if (!project.threadsLoaded) {
    return { recentThreads: project.threads, oldThreads: [] as Project["threads"] };
  }

  const cutoffMs = Date.now() - OLD_THREAD_THRESHOLD_MS;
  const recentThreads: Project["threads"] = [];
  const oldThreads: Project["threads"] = [];

  for (const thread of project.threads) {
    if ((thread.lastModifiedMs ?? Number.MAX_SAFE_INTEGER) >= cutoffMs) {
      recentThreads.push(thread);
    } else {
      oldThreads.push(thread);
    }
  }

  return { recentThreads, oldThreads };
}

function ProjectThreadsGroup({
  children,
  isExpanded,
  projectName,
  threadGroupId,
}: {
  children: React.ReactNode;
  isExpanded: boolean;
  projectName: string;
  threadGroupId: string;
}) {
  const present = useAnimatedPresence(isExpanded);

  if (!present) {
    return null;
  }

  return (
    <div
      id={threadGroupId}
      aria-label={`Threads in ${projectName}`}
      data-open={isExpanded ? "true" : "false"}
      className="motion-collapse-panel"
    >
      <div className="motion-collapse-panel__inner">{children}</div>
    </div>
  );
}

function OldSessionsRow({
  expanded,
  onArchiveAll,
  onToggle,
}: {
  expanded: boolean;
  onArchiveAll: () => void;
  onToggle: () => void;
}) {
  return (
    <div className="sidebar-row-surface sidebar-old-sessions-row">
      <Tooltip content={expanded ? "Collapse old" : "Expand old"} placement="right">
        <button
          type="button"
          className="sidebar-old-sessions-toggle"
          onClick={onToggle}
          aria-label={expanded ? "Collapse old" : "Expand old"}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
      </Tooltip>

      <button type="button" className="sidebar-old-sessions-button" onClick={onToggle}>
        <span className="truncate">Old sessions</span>
      </button>

      <Tooltip content="Archive old" placement="right" className="sidebar-old-sessions-action">
        <button
          type="button"
          className={cn(
            compactIconButtonClass,
            "h-full w-full border-transparent bg-transparent text-[color:var(--muted-2)] hover:bg-transparent hover:text-[color:var(--text)]",
          )}
          onClick={onArchiveAll}
          aria-label="Archive old"
        >
          <Archive size={12} />
        </button>
      </Tooltip>
    </div>
  );
}

export function ProjectThreadsList({
  activeView,
  expandedByUser,
  isExpanded,
  project,
  revealOldThreads,
  selectedThreadId,
  terminalRunningSessionPaths,
  threadGroupId,
  onAction,
  onCloseProjectMenu,
  onThreadOpen,
  onToggleOldThreads,
}: ProjectThreadsListProps) {
  const hasThreads = project.threadsLoaded
    ? project.threads.length > 0
    : (project.threadCount ?? 0) > 0;
  const { recentThreads, oldThreads } = partitionProjectThreads(project);
  const selectedOldThreadVisible = oldThreads.some((thread) => thread.id === selectedThreadId);
  const oldThreadsExpanded = revealOldThreads || selectedOldThreadVisible || expandedByUser;
  const renderThread = (thread: Project["threads"][number]) => {
    const isSelected =
      selectedThreadId === thread.id && (activeView === "thread" || activeView === "gitops");

    return (
      <ThreadRow
        key={thread.id}
        age={thread.age}
        pinned={Boolean(thread.pinned)}
        running={Boolean(thread.running)}
        terminalRunning={Boolean(
          thread.sessionPath && terminalRunningSessionPaths.has(thread.sessionPath),
        )}
        unread={Boolean(thread.unread)}
        isSelected={isSelected}
        title={thread.title}
        onArchive={() =>
          onAction("thread.archive", {
            projectId: project.id,
            threadId: thread.id,
          })
        }
        onOpen={() => {
          if (!thread.sessionPath) {
            return;
          }

          onThreadOpen(project.id, thread.id, thread.sessionPath);
          onCloseProjectMenu();
        }}
        onPin={() =>
          onAction("thread.pin", {
            projectId: project.id,
            threadId: thread.id,
          })
        }
      />
    );
  };

  return (
    <ProjectThreadsGroup
      isExpanded={isExpanded}
      threadGroupId={threadGroupId}
      projectName={project.name}
    >
      {hasThreads ? (
        recentThreads.map(renderThread)
      ) : project.threadsLoaded || (project.threadCount ?? 0) === 0 ? (
        <EmptyThreadsState />
      ) : null}

      {oldThreads.length > 0 ? (
        <>
          <OldSessionsRow
            expanded={oldThreadsExpanded}
            onToggle={() => onToggleOldThreads(oldThreadsExpanded)}
            onArchiveAll={() => {
              void onAction("thread.archive-many", {
                projectId: project.id,
                threadIds: oldThreads.map((thread) => thread.id),
              });
            }}
          />

          {oldThreadsExpanded ? oldThreads.map(renderThread) : null}
        </>
      ) : null}
    </ProjectThreadsGroup>
  );
}
