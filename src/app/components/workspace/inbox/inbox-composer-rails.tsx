import { Paperclip, Square, X } from 'lucide-react'
import type { RefObject } from 'react'
import { compactIconButtonClass } from '../../../ui/classes'
import { cn } from '../../../utils/cn'

type InboxAttachmentRailProps = {
  attachmentCount: number
  pickerButtonRef: RefObject<HTMLButtonElement | null>
  onClearAttachments: () => void
  onPickAttachments: () => void
}

export function InboxAttachmentRail({
  attachmentCount,
  pickerButtonRef,
  onClearAttachments,
  onPickAttachments,
}: InboxAttachmentRailProps) {
  const attachmentButtonLabel = attachmentCount > 0 ? 'Manage attachments' : 'Add attachment'
  return (
    <div className="relative h-full min-h-[7rem] w-8 shrink-0 self-stretch text-[color:var(--muted)]">
      <div className="absolute bottom-[3.55rem] left-0 flex w-7 flex-col-reverse items-center gap-1">
        {attachmentCount > 0 ? (
          <>
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[color:var(--accent-bg-subtle)] px-1.5 py-0.5 text-[11px] text-[color:var(--text)]">
              {attachmentCount}
            </span>
            <button
              type="button"
              className={cn(compactIconButtonClass, 'h-5 w-5 shrink-0 rounded-full')}
              onClick={onClearAttachments}
              aria-label="Clear attachments"
              data-tooltip="Clear attachments"
            >
              <X size={12} />
            </button>
          </>
        ) : null}
        <button
          ref={pickerButtonRef}
          type="button"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
          onClick={onPickAttachments}
          aria-label={attachmentButtonLabel}
          data-tooltip={attachmentButtonLabel}
        >
          <span className={cn(compactIconButtonClass, 'h-7 w-7 shrink-0 rounded-full')}>
            <Paperclip size={15} />
          </span>
        </button>
      </div>
    </div>
  )
}

type InboxStopRailProps = {
  isStreaming: boolean
  isSending: boolean
  localActionPending: boolean
  onStop: () => void
}

export function InboxStopRail({
  isStreaming,
  isSending,
  localActionPending,
  onStop,
}: InboxStopRailProps) {
  const canStop = isStreaming && !isSending && !localActionPending
  return (
    <div className="relative h-full min-h-[7rem] w-8 shrink-0 self-stretch text-[color:var(--muted)]">
      <div className="absolute right-0 bottom-[3.55rem] flex w-7 items-center justify-center">
        <button
          type="button"
          className={cn(
            compactIconButtonClass,
            'h-7 w-7 shrink-0 rounded-full text-[color:var(--danger)] hover:bg-[color:var(--danger-bg)] hover:text-[color:var(--danger)]',
            canStop
              ? 'bg-[color:var(--danger-bg)] opacity-80'
              : 'bg-transparent opacity-25 hover:opacity-45',
          )}
          onClick={onStop}
          disabled={!canStop}
          aria-label="Stop Pi"
          data-tooltip="Stop Pi"
        >
          <Square size={11} fill="currentColor" />
        </button>
      </div>
    </div>
  )
}
