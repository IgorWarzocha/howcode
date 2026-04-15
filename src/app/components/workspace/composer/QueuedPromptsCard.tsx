import { X } from "lucide-react";
import type { ComposerQueuedPrompt } from "../../../desktop/types";
import { compactCardClass, compactIconButtonClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";

type QueuedPromptsCardProps = {
  prompts: ComposerQueuedPrompt[];
  onEditPrompt: (prompt: ComposerQueuedPrompt) => void;
  onRemovePrompt: (prompt: ComposerQueuedPrompt) => void;
};

export function QueuedPromptsCard({
  prompts,
  onEditPrompt,
  onRemovePrompt,
}: QueuedPromptsCardProps) {
  if (prompts.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "relative -left-1 mx-auto grid w-full max-w-[664px] gap-1.5 rounded-t-xl rounded-b-none border border-[color:var(--border)] bg-[#272a39] px-2.5 py-2",
      )}
    >
      <div className="pl-3.5 text-[12px] text-[color:var(--muted)]">
        Queued messages. Click to edit.
      </div>

      <div className="grid gap-1">
        {prompts.map((prompt) => (
          <div
            key={prompt.id}
            className={cn(
              compactCardClass,
              "group grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-xl border-transparent px-1 py-0 text-[12px] shadow-none hover:border-[color:var(--border)]",
            )}
          >
            <button
              type="button"
              className="min-w-0 px-2.5 py-1 text-left text-[12px] leading-5 text-[color:var(--text)]/88"
              onClick={() => onEditPrompt(prompt)}
            >
              <span className="block truncate">{prompt.text}</span>
            </button>

            <button
              type="button"
              className={cn(compactIconButtonClass, "mr-1 shrink-0")}
              onClick={() => onRemovePrompt(prompt)}
              aria-label="Remove queued message"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
