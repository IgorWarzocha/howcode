import { ArchiveRestore, Trash2 } from "lucide-react";
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
  return (
    <ViewShell maxWidthClassName="max-w-[880px]">
      <ViewHeader
        title="Archived threads"
        subtitle="Restore archived threads back into the sidebar or delete them permanently from the app and disk."
      />

      {threads.length > 0 ? (
        <div className="grid gap-2">
          {threads.map((thread) => (
            <div
              key={thread.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] px-4 py-3"
            >
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
                  onClick={() =>
                    onAction("thread.restore", {
                      projectId: thread.projectId,
                      threadId: thread.id,
                    })
                  }
                >
                  <ArchiveRestore size={14} />
                  Restore
                </PrimaryButton>
                <TextButton
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[color:var(--muted)] hover:text-[#ffb4b4]"
                  onClick={() =>
                    onAction("thread.delete", {
                      projectId: thread.projectId,
                      threadId: thread.id,
                    })
                  }
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
