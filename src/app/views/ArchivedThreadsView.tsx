import { ArchiveRestore, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ConfirmPopover } from "../components/common/ConfirmPopover";
import { PrimaryButton } from "../components/common/PrimaryButton";
import { TextButton } from "../components/common/TextButton";
import { ViewHeader } from "../components/common/ViewHeader";
import { ViewShell } from "../components/common/ViewShell";
import type { ArchivedThread, DesktopActionInvoker } from "../desktop/types";

type ArchivedThreadsViewProps = {
  threads: ArchivedThread[];
  onAction: DesktopActionInvoker;
};

export function ArchivedThreadsView({ threads, onAction }: ArchivedThreadsViewProps) {
  const [selectedThreadIds, setSelectedThreadIds] = useState<string[]>([]);
  const [optimisticallyHiddenThreadIds, setOptimisticallyHiddenThreadIds] = useState<string[]>([]);
  const [busyAction, setBusyAction] = useState<"restore" | "delete" | null>(null);
  const [confirmBulkDeleteTarget, setConfirmBulkDeleteTarget] = useState<"all" | "selected" | null>(
    null,
  );
  const deleteAllButtonRef = useRef<HTMLButtonElement>(null);
  const deleteSelectedButtonRef = useRef<HTMLButtonElement>(null);

  const visibleThreads = useMemo(
    () => threads.filter((thread) => !optimisticallyHiddenThreadIds.includes(thread.id)),
    [optimisticallyHiddenThreadIds, threads],
  );
  const visibleThreadIds = useMemo(
    () => visibleThreads.map((thread) => thread.id),
    [visibleThreads],
  );
  const selectedVisibleThreads = useMemo(
    () => visibleThreads.filter((thread) => selectedThreadIds.includes(thread.id)),
    [selectedThreadIds, visibleThreads],
  );
  const selectedVisibleProjectIds = useMemo(
    () => [...new Set(selectedVisibleThreads.map((thread) => thread.projectId))],
    [selectedVisibleThreads],
  );

  useEffect(() => {
    const threadIds = new Set(threads.map((thread) => thread.id));

    setOptimisticallyHiddenThreadIds((current) =>
      current.filter((threadId) => threadIds.has(threadId)),
    );
  }, [threads]);

  useEffect(() => {
    const nextVisibleThreadIds = new Set(visibleThreadIds);

    setSelectedThreadIds((current) =>
      current.filter((threadId) => nextVisibleThreadIds.has(threadId)),
    );
  }, [visibleThreadIds]);

  useEffect(() => {
    if (busyAction !== null) {
      setConfirmBulkDeleteTarget(null);
    }
  }, [busyAction]);

  const allVisibleSelected =
    visibleThreadIds.length > 0 && selectedThreadIds.length === visibleThreadIds.length;

  const runArchivedThreadMutation = async ({
    action,
    busyState,
    threadIds,
    projectId,
    projectIds,
  }: {
    action: "thread.restore" | "thread.restore-many" | "thread.delete" | "thread.delete-many";
    busyState: "restore" | "delete";
    threadIds: string[];
    projectId?: string;
    projectIds?: string[];
  }) => {
    if (threadIds.length === 0 || busyAction) {
      return;
    }

    setBusyAction(busyState);
    setOptimisticallyHiddenThreadIds((current) => [...new Set([...current, ...threadIds])]);
    setSelectedThreadIds((current) => current.filter((threadId) => !threadIds.includes(threadId)));

    try {
      const result = await onAction(
        action,
        action === "thread.restore" || action === "thread.delete"
          ? { projectId, threadId: threadIds[0] }
          : { projectIds, threadIds },
      );
      const failed =
        result === null || result.ok === false || typeof result.result?.error === "string";

      if (failed) {
        const deletedThreadIds = Array.isArray(result?.result?.deletedThreadIds)
          ? result.result.deletedThreadIds.filter(
              (threadId): threadId is string => typeof threadId === "string",
            )
          : [];
        const failedThreadIds = Array.isArray(result?.result?.failedThreadIds)
          ? result.result.failedThreadIds.filter(
              (threadId): threadId is string => typeof threadId === "string",
            )
          : [];
        const restoredThreadIds =
          failedThreadIds.length > 0
            ? failedThreadIds
            : deletedThreadIds.length > 0
              ? threadIds.filter((threadId) => !deletedThreadIds.includes(threadId))
              : threadIds;

        setOptimisticallyHiddenThreadIds((current) =>
          current.filter((threadId) => !restoredThreadIds.includes(threadId)),
        );
      }
    } catch {
      setOptimisticallyHiddenThreadIds((current) =>
        current.filter((threadId) => !threadIds.includes(threadId)),
      );
    }

    setBusyAction(null);
  };

  return (
    <ViewShell maxWidthClassName="max-w-[880px]">
      <ViewHeader
        title="Archived threads"
        subtitle="Restore archived threads back into the sidebar or delete them permanently from the app and disk."
        actions={
          visibleThreads.length > 0 ? (
            <div className="relative">
              <TextButton
                ref={deleteAllButtonRef}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[color:var(--muted)] hover:text-[#ffb4b4]"
                disabled={busyAction !== null}
                onClick={() => {
                  setConfirmBulkDeleteTarget((current) => (current === "all" ? null : "all"));
                }}
              >
                <Trash2 size={14} />
                Delete all
              </TextButton>

              <ConfirmPopover
                open={confirmBulkDeleteTarget === "all"}
                anchorRef={deleteAllButtonRef}
                confirmLabel="Delete"
                onClose={() => setConfirmBulkDeleteTarget(null)}
                onConfirm={() => {
                  setConfirmBulkDeleteTarget(null);
                  void runArchivedThreadMutation({
                    action: "thread.delete-many",
                    busyState: "delete",
                    projectIds: [...new Set(visibleThreads.map((thread) => thread.projectId))],
                    threadIds: visibleThreadIds,
                  });
                }}
              />
            </div>
          ) : null
        }
      />

      {visibleThreads.length > 0 ? (
        <div className="grid gap-2">
          <div className="flex items-center justify-between rounded-2xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-[13px] text-[color:var(--muted)]">
            <label className="inline-flex items-center gap-2 text-[color:var(--text)]">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[color:var(--accent)]"
                checked={allVisibleSelected}
                onChange={() => setSelectedThreadIds(allVisibleSelected ? [] : visibleThreadIds)}
                disabled={busyAction !== null}
                aria-label="Select all archived threads"
              />
              <span>
                {selectedThreadIds.length > 0
                  ? `${selectedThreadIds.length} selected`
                  : "Select archived threads"}
              </span>
            </label>

            <div className="flex items-center gap-2">
              <PrimaryButton
                className="inline-flex items-center gap-1.5 px-3"
                disabled={selectedThreadIds.length === 0 || busyAction !== null}
                onClick={() => {
                  void runArchivedThreadMutation({
                    action: "thread.restore-many",
                    busyState: "restore",
                    projectIds: [
                      ...new Set(
                        visibleThreads
                          .filter((thread) => selectedThreadIds.includes(thread.id))
                          .map((thread) => thread.projectId),
                      ),
                    ],
                    threadIds: selectedThreadIds,
                  });
                }}
              >
                <ArchiveRestore size={14} />
                Restore selected
              </PrimaryButton>
              <div className="relative">
                <TextButton
                  ref={deleteSelectedButtonRef}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[color:var(--muted)] hover:text-[#ffb4b4]"
                  disabled={selectedThreadIds.length === 0 || busyAction !== null}
                  onClick={() => {
                    setConfirmBulkDeleteTarget((current) =>
                      current === "selected" ? null : "selected",
                    );
                  }}
                >
                  <Trash2 size={14} />
                  Delete selected
                </TextButton>

                <ConfirmPopover
                  open={confirmBulkDeleteTarget === "selected"}
                  anchorRef={deleteSelectedButtonRef}
                  confirmLabel="Delete"
                  onClose={() => setConfirmBulkDeleteTarget(null)}
                  onConfirm={() => {
                    setConfirmBulkDeleteTarget(null);
                    void runArchivedThreadMutation({
                      action: "thread.delete-many",
                      busyState: "delete",
                      projectIds: selectedVisibleProjectIds,
                      threadIds: selectedThreadIds,
                    });
                  }}
                />
              </div>
            </div>
          </div>

          {visibleThreads.map((thread) => (
            <div
              key={thread.id}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] px-4 py-3"
            >
              <input
                type="checkbox"
                className="h-4 w-4 accent-[color:var(--accent)]"
                checked={selectedThreadIds.includes(thread.id)}
                onChange={() =>
                  setSelectedThreadIds((current) =>
                    current.includes(thread.id)
                      ? current.filter((threadId) => threadId !== thread.id)
                      : [...current, thread.id],
                  )
                }
                disabled={busyAction !== null}
                aria-label={`Select ${thread.title}`}
              />

              <div className="min-w-0">
                <div className="truncate text-[14px] text-[color:var(--text)]">{thread.title}</div>
                <div className="mt-1 flex items-center gap-2 text-[12px] text-[color:var(--muted)]">
                  <span className="truncate">{thread.projectName}</span>
                  <span aria-hidden="true">•</span>
                  <span>{thread.age}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <PrimaryButton
                  className="inline-flex items-center gap-1.5 px-3"
                  disabled={busyAction !== null}
                  onClick={() => {
                    void runArchivedThreadMutation({
                      action: "thread.restore",
                      busyState: "restore",
                      threadIds: [thread.id],
                      projectId: thread.projectId,
                    });
                  }}
                >
                  <ArchiveRestore size={14} />
                  Restore
                </PrimaryButton>
                <TextButton
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[color:var(--muted)] hover:text-[#ffb4b4]"
                  disabled={busyAction !== null}
                  onClick={() => {
                    void runArchivedThreadMutation({
                      action: "thread.delete",
                      busyState: "delete",
                      threadIds: [thread.id],
                      projectId: thread.projectId,
                    });
                  }}
                >
                  <Trash2 size={14} />
                  Delete permanently
                </TextButton>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid min-h-60 place-items-center px-6 text-center text-[13px] text-[color:var(--muted)]">
          <div className="grid gap-2">
            <div className="text-[15px] text-[color:var(--text)]">No archived threads</div>
            <p className="m-0 max-w-[448px]">
              Archive a thread from the sidebar and it will show up here for restore or permanent
              deletion.
            </p>
          </div>
        </div>
      )}
    </ViewShell>
  );
}
