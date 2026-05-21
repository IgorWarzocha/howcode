import { X } from 'lucide-react'
import type { ComposerQueuedPrompt } from '../../../desktop/types'
import { compactIconButtonClass } from '../../../ui/classes'
import { cn } from '../../../utils/cn'

type QueuedPromptsCardProps = {
  prompts: ComposerQueuedPrompt[]
  pendingPromptIds?: string[]
  onEditPrompt: (prompt: ComposerQueuedPrompt) => void
  onRemovePrompt: (prompt: ComposerQueuedPrompt) => void
}

const EMPTY_PENDING_PROMPT_IDS: string[] = []

export function QueuedPromptsCard({
  prompts,
  pendingPromptIds = EMPTY_PENDING_PROMPT_IDS,
  onEditPrompt,
  onRemovePrompt,
}: QueuedPromptsCardProps) {
  if (prompts.length === 0) {
    return null
  }

  return (
    <div className="grid w-full grid-cols-[2rem_minmax(0,1fr)_2rem] items-end gap-2 overflow-visible">
      <div
        className={cn(
          'col-start-2 mx-auto grid w-full max-w-[664px] gap-1.5 rounded-t-lg rounded-b-none border border-[color:var(--border)] bg-[color:var(--panel)] px-2.5 py-2 shadow-none',
        )}
      >
        <div className="pl-3.5 text-[12px] text-[color:var(--muted)]">
          Queued messages. Click to edit.
        </div>

        <div className="grid gap-1">
          {prompts.map((prompt) => {
            const isPending = pendingPromptIds.includes(prompt.id)

            return (
              <div
                key={prompt.id}
                className={cn(
                  'group grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-lg px-1 py-0 text-[12px] transition-colors hover:bg-[color:var(--surface-hover)]',
                  isPending && 'opacity-60',
                )}
              >
                <button
                  type="button"
                  className="min-w-0 px-2.5 py-1 text-left text-[12px] leading-5 text-[color:var(--text)]/88 disabled:cursor-default"
                  onClick={() => onEditPrompt(prompt)}
                  disabled={isPending}
                >
                  <span className="block truncate">{prompt.text}</span>
                </button>

                <button
                  type="button"
                  className={cn(compactIconButtonClass, 'mr-1 shrink-0')}
                  onClick={() => onRemovePrompt(prompt)}
                  aria-label="Remove queued"
                  disabled={isPending}
                  data-tooltip="Remove queued"
                >
                  <X size={12} />
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
