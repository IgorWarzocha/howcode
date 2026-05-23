import { X } from 'lucide-react'
import type { ComposerQueuedPrompt } from '../../../desktop/types'
import { appToneMutedClass, appTypeSmallClass, compactIconButtonClass } from '../../../ui/classes'
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
    <div className="grid w-full overflow-visible px-[3.5rem]">
      <div className="grid w-full gap-1.5 rounded-t-lg rounded-b-none border border-[color:var(--border)] bg-[color:var(--panel)] px-2.5 py-2 shadow-none">
        <div className={cn('pl-3.5', appTypeSmallClass, appToneMutedClass)}>
          Queued messages. Click to edit.
        </div>

        <div className="grid gap-1">
          {prompts.map((prompt) => {
            const isPending = pendingPromptIds.includes(prompt.id)

            return (
              <div
                key={prompt.id}
                className={cn(
                  'group grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-lg px-1 py-0 transition-colors hover:bg-[color:var(--surface-hover)]',
                  appTypeSmallClass,
                  isPending && 'opacity-60',
                )}
              >
                <button
                  type="button"
                  className={cn(
                    'min-w-0 px-2.5 py-1 text-left text-[color:var(--text)]/88 disabled:cursor-default',
                    appTypeSmallClass,
                  )}
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
