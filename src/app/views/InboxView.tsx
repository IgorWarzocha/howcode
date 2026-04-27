import { useState } from "react";
import { getDesktopActionErrorMessage } from "../desktop/action-results";
import { getErrorMessage } from "../desktop/error-messages";
import { EmptyStateCard } from "../components/common/EmptyStateCard";
import { MarkdownContent } from "../components/common/MarkdownContent";
import { InboxComposer } from "../components/workspace/inbox/InboxComposer";
import { isCompactSlashCommand } from "../../../shared/composer-slash-commands";
import type {
  AppSettings,
  ComposerAttachment,
  ComposerContextUsage,
  ComposerFilePickerState,
  ComposerModel,
  ComposerThinkingLevel,
  DesktopActionInvoker,
  InboxThread,
} from "../desktop/types";

type InboxViewProps = {
  appSettings: AppSettings;
  availableModels: ComposerModel[];
  availableThinkingLevels: ComposerThinkingLevel[];
  contextUsage: ComposerContextUsage | null;
  currentModel: ComposerModel | null;
  currentThinkingLevel: ComposerThinkingLevel;
  favoriteFolders: string[];
  isCompacting: boolean;
  showDictationButton: boolean;
  thread: InboxThread | null;
  onAction: DesktopActionInvoker;
  onDismissThread: (thread: InboxThread) => void;
  onListAttachmentEntries: (request: {
    projectId?: string | null;
    path?: string | null;
    rootPath?: string | null;
  }) => Promise<ComposerFilePickerState | null>;
  onOpenThread: (projectId: string, threadId: string, sessionPath: string) => void;
  onOpenSettingsView: () => void;
};

export function InboxView({
  appSettings,
  availableModels,
  availableThinkingLevels,
  contextUsage,
  currentModel,
  currentThinkingLevel,
  favoriteFolders,
  isCompacting,
  showDictationButton,
  thread,
  onAction,
  onDismissThread,
  onListAttachmentEntries,
  onOpenThread,
  onOpenSettingsView,
}: InboxViewProps) {
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSend = async (input?: {
    draft: string;
    attachments: ComposerAttachment[];
  }) => {
    const draftToSend = input?.draft ?? draft;
    const attachmentsToSend = input?.attachments ?? attachments;
    const nextDraft = draftToSend.trim();
    const isCompactCommand = isCompactSlashCommand(nextDraft);
    if (
      !thread ||
      (nextDraft.length === 0 && attachmentsToSend.length === 0) ||
      isSending ||
      isCompacting
    ) {
      return;
    }

    setIsSending(true);
    setErrorMessage(null);

    let result: Awaited<ReturnType<DesktopActionInvoker>> | null = null;

    try {
      result = await onAction("composer.send", {
        projectId: thread.projectId,
        sessionPath: thread.sessionPath,
        text: nextDraft,
        attachments: isCompactCommand ? [] : attachmentsToSend,
        streamingBehavior: appSettings.composerStreamingBehavior,
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not send follow-up."));
      return;
    } finally {
      setIsSending(false);
    }

    const actionErrorMessage = getDesktopActionErrorMessage(result, "Could not send follow-up.");
    if (actionErrorMessage) {
      setErrorMessage(actionErrorMessage);
      return;
    }

    if (result?.result?.composerSendOutcome !== "stopped" && !isCompactCommand) {
      setDraft("");
      setAttachments([]);
      onDismissThread(thread);
    }
  };

  const handleStop = async () => {
    if (!thread?.running || isSending) {
      return;
    }

    setIsSending(true);
    setErrorMessage(null);

    try {
      const result = await onAction("composer.stop", {
        projectId: thread.projectId,
        sessionPath: thread.sessionPath,
      });

      const actionErrorMessage = getDesktopActionErrorMessage(result, "Could not stop Pi.");
      if (actionErrorMessage) {
        setErrorMessage(actionErrorMessage);
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not stop Pi."));
    } finally {
      setIsSending(false);
    }
  };

  if (!thread) {
    return (
      <div className="grid h-full min-h-0 place-items-center px-6 py-6">
        <div className="w-full max-w-[520px]">
          <EmptyStateCard className="grid gap-2 rounded-[18px] px-5 py-5 text-center text-[13px] text-[color:var(--muted)]">
            <div className="text-[15px] font-medium text-[color:var(--text)]">Inbox is waiting</div>
            <div>
              Select a thread on the left to skim Pi’s latest reply and either answer or clear it.
            </div>
          </EmptyStateCard>
        </div>
      </div>
    );
  }

  const prompt = thread.prompt?.trim() || thread.title;
  const messageMarkdown = thread.content.join("\n\n").trim();

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] px-6 pt-6 pb-4">
      <div className="w-full pb-5">
        <div className="grid w-full gap-2 rounded-[18px] border border-[rgba(169,178,215,0.09)] bg-[rgba(43,47,62,0.72)] px-4 py-3 shadow-[0_18px_48px_rgba(7,8,14,0.16)]">
          <div className="flex min-w-0 items-center gap-2 text-[11px] leading-4 text-[color:var(--muted-2)]">
            <span className="truncate">{thread.projectName}</span>
            <span aria-hidden="true">•</span>
            <span className="shrink-0 tabular-nums">{thread.age}</span>
            {thread.running ? (
              <>
                <span aria-hidden="true">•</span>
                <span className="shrink-0 text-[color:var(--accent)]">working</span>
              </>
            ) : null}
          </div>
          <p className="m-0 max-h-[calc(1.55em*4)] overflow-y-auto whitespace-pre-wrap break-words text-[15px] leading-[1.55] text-[color:var(--text)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {prompt}
          </p>
        </div>
      </div>

      <div className="min-h-0 overflow-y-auto">
        <div className="grid h-full w-full content-start pb-5">
          <div className="min-h-0 max-w-[92ch] text-pretty">
            {messageMarkdown ? (
              <MarkdownContent markdown={messageMarkdown} className="gap-3 text-[15px]" />
            ) : (
              <div className="grid min-h-28 place-items-center rounded-[18px] border border-dashed border-[color:var(--border)] text-[14px] text-[color:var(--muted)]">
                {thread.running ? "Still working…" : "No final assistant message yet."}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="pt-1">
        <div className="w-full">
          <InboxComposer
            appSettings={appSettings}
            attachments={attachments}
            availableModels={availableModels}
            availableThinkingLevels={availableThinkingLevels}
            contextUsage={contextUsage}
            currentModel={currentModel}
            currentThinkingLevel={currentThinkingLevel}
            draft={draft}
            errorMessage={errorMessage}
            favoriteFolders={favoriteFolders}
            isCompacting={isCompacting}
            isStreaming={thread.running}
            isSending={isSending}
            showDictationButton={showDictationButton}
            thread={thread}
            onChangeDraft={setDraft}
            onChangeAttachments={setAttachments}
            onChangeErrorMessage={setErrorMessage}
            onAction={onAction}
            onDismiss={() => onDismissThread(thread)}
            onListAttachmentEntries={onListAttachmentEntries}
            onOpenThread={() => onOpenThread(thread.projectId, thread.threadId, thread.sessionPath)}
            onOpenSettingsView={onOpenSettingsView}
            onSend={(sendInput) => handleSend(sendInput)}
            onStop={handleStop}
          />
        </div>
      </div>
    </div>
  );
}
