import { FolderPlus, MessageSquarePlus } from "lucide-react";
import { useState } from "react";
import type { ChatSidebarState, DesktopActionInvoker } from "../../../desktop/types";
import { TextButton } from "../../common/TextButton";
import { ThreadRow } from "../project-tree/ThreadRow";

type SidebarChatSectionProps = {
  chatState: ChatSidebarState | null;
  selectedGroupId: string | null;
  selectedThreadId: string | null;
  onCreateGroup: (name: string) => Promise<unknown>;
  onSelectGroup: (groupId: string | null) => void;
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void;
  onAction: DesktopActionInvoker;
};

export function SidebarChatSection({
  chatState,
  selectedGroupId,
  selectedThreadId,
  onCreateGroup,
  onSelectGroup,
  onThreadOpen,
  onAction,
}: SidebarChatSectionProps) {
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");

  const submitGroup = async () => {
    const name = draft.trim();
    if (!name) return;
    await onCreateGroup(name);
    setDraft("");
    setCreating(false);
  };

  const renderThread = (thread: NonNullable<ChatSidebarState>["ungroupedThreads"][number]) => (
    <ThreadRow
      key={thread.id}
      age={thread.age}
      pinned={Boolean(thread.pinned)}
      running={Boolean(thread.running)}
      terminalRunning={false}
      unread={Boolean(thread.unread)}
      isSelected={selectedThreadId === thread.id}
      title={thread.title}
      onArchive={() => void onAction("thread.archive", { threadId: thread.id })}
      onOpen={() =>
        thread.sessionPath && onThreadOpen(thread.projectId, thread.id, thread.sessionPath)
      }
      onPin={() => void onAction("thread.pin", { threadId: thread.id })}
    />
  );

  return (
    <div className="min-h-0 overflow-y-auto px-2 py-2">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
          Chat groups
        </div>
        <TextButton
          type="button"
          className="h-7 rounded-md px-2 text-[12px]"
          onClick={() => setCreating((current) => !current)}
        >
          <FolderPlus size={13} />
        </TextButton>
      </div>

      {creating ? (
        <form
          className="mb-2 grid gap-1 px-1"
          onSubmit={(event) => {
            event.preventDefault();
            void submitGroup();
          }}
        >
          <input
            className="h-8 rounded-md border border-[color:var(--border)] bg-[color:var(--input-bg)] px-2 text-[13px] outline-none"
            value={draft}
            placeholder="Group name"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setCreating(false);
            }}
          />
        </form>
      ) : null}

      <button
        type="button"
        className="sidebar-row-surface mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px]"
        data-selected={selectedGroupId === null ? "true" : "false"}
        onClick={() => onSelectGroup(null)}
      >
        <MessageSquarePlus size={14} /> New chats
      </button>
      <div className="mb-2 grid gap-0.5">{chatState?.ungroupedThreads.map(renderThread)}</div>

      {chatState?.groups.map((group) => (
        <section key={group.id} className="mb-2">
          <button
            type="button"
            className="sidebar-row-surface mb-1 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] font-medium"
            data-selected={selectedGroupId === group.id ? "true" : "false"}
            onClick={() => onSelectGroup(group.id)}
          >
            <span className="truncate">{group.name}</span>
            <span className="text-[11px] text-[color:var(--muted)]">{group.threads.length}</span>
          </button>
          <div className="grid gap-0.5">{group.threads.map(renderThread)}</div>
        </section>
      ))}
    </div>
  );
}
