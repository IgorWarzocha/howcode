import { ArchiveRestore, Trash2, X } from "lucide-react";
import type { DesktopAction } from "../../desktop/actions";
import type { ArchivedThread } from "../../desktop/types";
import { PrimaryButton } from "../common/PrimaryButton";
import { SurfacePanel } from "../common/SurfacePanel";
import { TextButton } from "../common/TextButton";

type ArchivedThreadsPanelProps = {
  threads: ArchivedThread[];
  open: boolean;
  onClose: () => void;
  onAction: (action: DesktopAction, payload?: Record<string, unknown>) => void;
};

export function ArchivedThreadsPanel({
  threads,
  open,
  onClose,
  onAction,
}: ArchivedThreadsPanelProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(8,10,18,0.52)] px-6 py-8 backdrop-blur-sm">
      <SurfacePanel className="flex h-full max-h-[720px] w-full max-w-[880px] flex-col overflow-hidden rounded-[24px] border-[color:var(--border-strong)] bg-[rgba(34,37,50,0.96)] shadow-[0_24px_80px_rgba(0,0,0,0.34)]">
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--border)] px-6 py-5">
          <div>
            <div className="text-[18px] font-medium text-[color:var(--text)]">Archived threads</div>
            <p className="mt-1 text-[13px] text-[color:var(--muted)]">
              Restore archived threads back into the sidebar or delete them permanently from the app
              and disk.
            </p>
          </div>
          <TextButton className="p-1" onClick={onClose}>
            <X size={16} />
          </TextButton>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {threads.length > 0 ? (
            <div className="grid gap-2">
              {threads.map((thread) => (
                <div
                  key={thread.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-[16px] border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[14px] text-[color:var(--text)]">
                      {thread.title}
                    </div>
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
            <div className="grid h-full place-items-center px-6 text-center text-[13px] text-[color:var(--muted)]">
              <div className="grid gap-2">
                <div className="text-[15px] text-[color:var(--text)]">No archived threads</div>
                <p className="m-0 max-w-[420px]">
                  Archive a thread from the sidebar and it will show up here for restore or
                  permanent deletion.
                </p>
              </div>
            </div>
          )}
        </div>
      </SurfacePanel>
    </div>
  );
}
