import { X } from "lucide-react";
import { compactCardClass, compactIconButtonClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";

export type MockQueuedPrompt = {
  id: string;
  text: string;
};

type MockQueuedPromptsCardProps = {
  prompts: MockQueuedPrompt[];
  onEditPrompt: (promptId: string) => void;
  onRemovePrompt: (promptId: string) => void;
};

export function MockQueuedPromptsCard({
  prompts,
  onEditPrompt,
  onRemovePrompt,
}: MockQueuedPromptsCardProps) {
  if (prompts.length === 0) {
    return null;
  }

  return (
    <div className="mx-auto grid w-full max-w-[664px] gap-1.5">
      <div className="px-1 text-[12px] text-[color:var(--muted)]">
        Queued messages. Click to edit.
      </div>

      <div className="grid gap-1">
        {prompts.map((prompt) => (
          <div
            key={prompt.id}
            className={cn(
              compactCardClass,
              "group grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-xl border-transparent bg-transparent px-1 py-0 text-[12px] shadow-none hover:border-[color:var(--border)] hover:bg-[rgba(255,255,255,0.03)]",
            )}
          >
            <button
              type="button"
              className="min-w-0 px-2.5 py-1 text-left text-[12px] leading-5 text-[color:var(--text)]/88"
              onClick={() => onEditPrompt(prompt.id)}
              title={prompt.text}
            >
              <span className="block truncate">{prompt.text}</span>
            </button>

            <button
              type="button"
              className={cn(compactIconButtonClass, "mr-1 shrink-0")}
              onClick={() => onRemovePrompt(prompt.id)}
              aria-label="Remove queued message"
              title="Remove queued message"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
