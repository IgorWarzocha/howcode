import { ArrowUpRight, Send, Square, X } from "lucide-react";
import { compactIconButtonClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import { IconButton } from "../../common/IconButton";
import { SurfacePanel } from "../../common/SurfacePanel";
import { Tooltip } from "../../common/Tooltip";
import { ComposerTextField } from "../composer/ComposerTextField";

type InboxComposerProps = {
  draft: string;
  errorMessage: string | null;
  isStreaming: boolean;
  isSending: boolean;
  onChangeDraft: (value: string) => void;
  onDismiss: () => void;
  onOpenThread: () => void;
  onSend: () => void;
  onStop: () => void;
};

export function InboxComposer({
  draft,
  errorMessage,
  isStreaming,
  isSending,
  onChangeDraft,
  onDismiss,
  onOpenThread,
  onSend,
  onStop,
}: InboxComposerProps) {
  const canSend = draft.trim().length > 0 && !isSending;

  return (
    <SurfacePanel
      className="grid gap-0 overflow-visible border-[rgba(169,178,215,0.06)] bg-[rgba(39,42,57,0.94)] shadow-none"
      aria-label="Inbox composer panel"
    >
      <div className="relative min-h-[148px]">
        <div className="grid min-h-[148px] content-end px-4 pt-[24px] pb-3">
          <div className="flex min-h-[82px] items-end justify-between gap-2">
            <div className="min-w-0 flex-1">
              <ComposerTextField
                value={draft}
                onChange={onChangeDraft}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    onSend();
                  }
                }}
                ariaLabel="Inbox prompt composer"
                placeholder="Reply to this thread…"
              />
            </div>

            <div className="inline-flex h-8 items-center justify-end gap-2">
              <button
                type="button"
                className={cn(
                  compactIconButtonClass,
                  "h-6 w-6 shrink-0 rounded-full bg-[rgba(229,111,111,0.18)] text-[#ffb4b4] hover:bg-[rgba(229,111,111,0.28)] hover:text-[#ffd1d1] disabled:cursor-not-allowed disabled:opacity-45",
                )}
                onClick={onStop}
                disabled={!isStreaming || isSending}
                aria-label="Stop Pi"
                title="Stop Pi"
              >
                <Square size={11} fill="currentColor" />
              </button>
              <button
                type="button"
                className={cn(
                  compactIconButtonClass,
                  "h-6 w-6 shrink-0 rounded-full bg-[rgba(146,153,184,0.46)] text-[color:var(--workspace)] hover:bg-[rgba(146,153,184,0.56)] hover:text-[color:var(--workspace)] disabled:cursor-not-allowed disabled:opacity-45",
                )}
                onClick={onSend}
                disabled={!canSend}
                aria-label="Send"
                title="Send"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {errorMessage ? (
        <output className="px-4 pb-2 text-[12px] text-[#f2a7a7]" aria-live="polite">
          {errorMessage}
        </output>
      ) : null}

      <div className="h-px bg-[rgba(169,178,215,0.07)]" />

      <div className="flex items-center justify-end gap-1.5 px-4 pt-2 pb-3 text-[color:var(--muted)] max-md:flex-wrap">
        <Tooltip content="Dismiss">
          <IconButton label="Dismiss" icon={<X size={14} />} onClick={onDismiss} />
        </Tooltip>
        <Tooltip content="Open thread">
          <IconButton
            label="Open thread"
            icon={<ArrowUpRight size={14} />}
            onClick={onOpenThread}
          />
        </Tooltip>
      </div>
    </SurfacePanel>
  );
}
