import { Paperclip, X } from 'lucide-react'
import type { RefObject } from 'react'
import {
  appToneTextClass,
  appTypeMetaClass,
  compactIconButtonClass,
  compactRoundIconButtonClass,
} from '../../../ui/classes'
import { cn } from '../../../utils/cn'

type ComposerAttachmentRailProps = {
  attachmentCount: number
  attachmentButtonLabel: string
  pickerButtonRef: RefObject<HTMLButtonElement | null>
  onClearAttachments: () => void
  onPickAttachments: () => void
}

export function ComposerAttachmentRail({
  attachmentCount,
  attachmentButtonLabel,
  pickerButtonRef,
  onClearAttachments,
  onPickAttachments,
}: ComposerAttachmentRailProps) {
  return (
    <div className="relative h-full min-h-0 w-8 shrink-0 self-stretch text-[color:var(--muted)]">
      <div className="absolute bottom-[3.35rem] left-0 flex w-7 flex-col-reverse items-center gap-1">
        {attachmentCount > 0 ? (
          <>
            <span
              className={cn(
                'inline-flex min-w-5 items-center justify-center rounded-full bg-[color:var(--accent-bg)] px-1.5 py-0.5',
                appTypeMetaClass,
                appToneTextClass,
              )}
            >
              {attachmentCount}
            </span>
            <button
              type="button"
              className={cn(
                compactIconButtonClass,
                'h-5 w-5 rounded-full opacity-70 hover:opacity-100',
              )}
              onClick={onClearAttachments}
              aria-label="Clear attachments"
              data-tooltip="Clear attachments"
            >
              <X size={11} />
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
          <span className={cn(compactRoundIconButtonClass, 'shrink-0')}>
            <Paperclip size={15} />
          </span>
        </button>
      </div>
    </div>
  )
}

type ComposerStopRailProps = {
  boundaryRef: RefObject<HTMLDivElement | null>
  canStopComposer: boolean
  onStop: () => void
}

export function ComposerStopRail({ boundaryRef, canStopComposer, onStop }: ComposerStopRailProps) {
  return (
    <div className="relative h-full min-h-0 w-8 shrink-0 self-stretch text-[color:var(--muted)]">
      <div
        ref={boundaryRef}
        className="absolute right-0 bottom-[3.35rem] flex w-7 items-center justify-center"
      >
        <button
          type="button"
          className={cn(
            compactIconButtonClass,
            'composer-stop-button relative h-7 w-7 shrink-0 text-[color:var(--danger)] hover:bg-[color:var(--danger-bg)] hover:text-[color:var(--danger)]',
            canStopComposer
              ? 'composer-stop-button--active bg-[color:var(--danger-bg)] opacity-95'
              : 'bg-transparent opacity-25 hover:opacity-45',
          )}
          onClick={onStop}
          disabled={!canStopComposer}
          aria-label="Stop Pi"
          data-tooltip="Stop Pi"
        >
          {canStopComposer ? (
            <svg
              className="composer-stop-button__spinner absolute text-white/50"
              viewBox="0 0 28 28"
              aria-hidden="true"
            >
              <g className="activity-spinner__rotor" fill="currentColor">
                <circle cx="14" cy="1.5" r="1.3" opacity=".14" />
                <circle cx="20.2" cy="3.05" r="1.3" opacity=".29" />
                <circle cx="24.95" cy="7.8" r="1.3" opacity=".43" />
                <circle cx="26.5" cy="14" r="1.3" opacity=".57" />
                <circle cx="24.95" cy="20.2" r="1.3" opacity=".71" />
                <circle cx="20.2" cy="24.95" r="1.3" opacity=".86" />
                <circle cx="14" cy="26.5" r="1.3" />
              </g>
            </svg>
          ) : null}
          <span className="composer-stop-button__square" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
