import { useState } from "react";
import { EmptyStateCard } from "../components/common/EmptyStateCard";
import { MarkdownContent } from "../components/common/MarkdownContent";
import { InboxComposer } from "../components/workspace/inbox/InboxComposer";
import type { DesktopActionInvoker, InboxThread } from "../desktop/types";

type InboxViewProps = {
  thread: InboxThread | null;
  onAction: DesktopActionInvoker;
  onDismissThread: (thread: InboxThread) => void;
  onOpenThread: (projectId: string, threadId: string, sessionPath: string) => void;
};

export function InboxView({ thread, onAction, onDismissThread, onOpenThread }: InboxViewProps) {
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSend = async () => {
    const nextDraft = draft.trim();
    if (!thread || !nextDraft || isSending) {
      return;
    }

    setIsSending(true);
    setErrorMessage(null);

    const result = await onAction("composer.send", {
      projectId: thread.projectId,
      sessionPath: thread.sessionPath,
      text: nextDraft,
    });

    setIsSending(false);

    if (!result?.ok || result.result?.error) {
      setErrorMessage(result?.result?.error ?? "Could not send follow-up.");
      return;
    }

    setDraft("");
    onDismissThread(thread);
  };

  if (!thread) {
    return (
      <div className="grid h-full min-h-0 px-5 pt-6 pb-4">
        <div className="mx-auto grid h-full w-full max-w-[860px] content-start">
          <EmptyStateCard className="grid gap-1.5 px-5 py-5 text-[14px] text-[color:var(--muted)]">
            <div className="text-[15px] text-[color:var(--text)]">No thread selected</div>
          </EmptyStateCard>
        </div>
      </div>
    );
  }

  const prompt = thread.prompt?.trim() || thread.title;
  const messageMarkdown = thread.content.join("\n\n").trim();

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] px-5 pt-5 pb-4">
      <div className="w-full pb-4">
        <div className="w-full max-h-[calc(1.7em*5+2rem)] overflow-y-auto rounded-2xl border border-[color:var(--border)] bg-[rgba(43,47,62,0.92)] px-4 py-4 shadow-[var(--shadow)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <p className="m-0 whitespace-pre-wrap break-words leading-[1.7] text-[color:var(--muted)]">
            {prompt}
          </p>
        </div>
      </div>

      <div className="min-h-0 overflow-y-auto">
        <div className="grid h-full w-full content-start pb-4">
          <div className="min-h-0">
            {messageMarkdown ? (
              <MarkdownContent markdown={messageMarkdown} className="gap-3 text-[15px]" />
            ) : (
              <div className="text-[14px] text-[color:var(--muted)]">
                {thread.running ? "Still working…" : "No final assistant message yet."}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="pt-2">
        <div className="w-full">
          <InboxComposer
            draft={draft}
            errorMessage={errorMessage}
            isSending={isSending}
            onChangeDraft={setDraft}
            onDismiss={() => onDismissThread(thread)}
            onOpenThread={() => onOpenThread(thread.projectId, thread.threadId, thread.sessionPath)}
            onSend={handleSend}
          />
        </div>
      </div>
    </div>
  );
}
