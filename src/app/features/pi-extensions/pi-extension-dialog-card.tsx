import { Check, X } from 'lucide-react'
import { useState } from 'react'
import type { PiExtensionDialogRequest } from '../../desktop/types'
import {
  appToneMutedClass,
  appToneTextClass,
  appTypeGroupTextClass,
  appTypeMetaClass,
  appTypeTinyClass,
  piExtensionTextClass,
} from '../../ui/classes'
import { cn } from '../../utils/cn'

type PiExtensionDialogCardProps = {
  request: PiExtensionDialogRequest
  embedded?: boolean | undefined
  onAnswer: (answer: {
    cancelled?: boolean | undefined
    confirmed?: boolean | undefined
    value?: string | undefined
  }) => Promise<boolean> | boolean
}

const piExtensionDialogCardClass =
  'relative grid w-full content-start gap-2 rounded-t-lg rounded-b-none border border-[color:var(--border)] bg-[color:var(--panel)] px-5 py-3 shadow-none'
const piExtensionDialogContentClass = `relative grid w-full content-start gap-1 ${piExtensionTextClass}`
type PiExtensionDialogAnswer = Parameters<PiExtensionDialogCardProps['onAnswer']>[0]

function PiExtensionDialogActions({
  busy,
  method,
  onAnswer,
  onSubmitTextValue,
}: {
  busy: boolean
  method: PiExtensionDialogRequest['method']
  onAnswer: (answer: PiExtensionDialogAnswer) => void
  onSubmitTextValue: () => void
}) {
  const canSubmit = method === 'confirm' || method === 'input' || method === 'editor'
  const acceptLabel = method === 'confirm' ? 'Accept' : 'Submit'

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label={method === 'confirm' ? 'Reject' : 'Cancel extension UI request'}
        title={method === 'confirm' ? 'Reject' : 'Cancel'}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--muted)] transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] disabled:opacity-55"
        disabled={busy}
        onClick={() => onAnswer(method === 'confirm' ? { confirmed: false } : { cancelled: true })}
      >
        <X size={13} />
      </button>
      {canSubmit ? (
        <button
          type="button"
          aria-label={acceptLabel}
          title={acceptLabel}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[color:var(--surface-hover)] text-[color:var(--text)] transition-colors hover:bg-[color:var(--panel-3)] disabled:opacity-55"
          disabled={busy}
          onClick={() =>
            method === 'confirm' ? onAnswer({ confirmed: true }) : onSubmitTextValue()
          }
        >
          <Check size={13} />
        </button>
      ) : null}
    </div>
  )
}

export function PiExtensionDialogCard({
  request,
  embedded = false,
  onAnswer,
}: PiExtensionDialogCardProps) {
  const [busy, setBusy] = useState(false)
  const [value, setValue] = useState(request.prefill ?? '')

  const answer = async (next: PiExtensionDialogAnswer) => {
    if (busy) return
    setBusy(true)
    const ok = await onAnswer(next)
    if (!ok) setBusy(false)
  }

  const submitTextValue = () => answer({ value })

  const content = (
    <div className={embedded ? piExtensionDialogContentClass : piExtensionDialogCardClass}>
      <div className="grid min-w-0 gap-0.5 pr-6">
        <div className="grid min-w-0 gap-0.5">
          <div className={cn('truncate', appTypeGroupTextClass, appToneTextClass)}>
            {request.title}
          </div>
          {request.message ? (
            <div className={cn('truncate', appTypeMetaClass, appToneMutedClass)}>
              {request.message}
            </div>
          ) : null}
        </div>
      </div>

      {request.method === 'select' ? (
        <div className="flex flex-wrap gap-1.5">
          {(request.options ?? []).map((option) => (
            <button
              key={option}
              type="button"
              className={cn(
                'inline-flex min-h-6 items-center rounded-md bg-[color:var(--surface-hover)] px-2 text-[color:var(--text)] transition-colors hover:bg-[color:var(--panel-3)] disabled:opacity-55',
                appTypeTinyClass,
              )}
              disabled={busy}
              onClick={() => void answer({ value: option })}
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}

      {request.method === 'input' || request.method === 'editor' ? (
        <textarea
          className={cn(
            'min-h-16 resize-none rounded-md border border-[color:var(--border)] bg-[color:var(--panel-2)] px-2 py-1.5 text-[color:var(--text)] outline-none placeholder:text-[color:var(--dim)] focus:border-[color:var(--border-strong)]',
            appTypeTinyClass,
          )}
          value={value}
          placeholder={request.placeholder}
          rows={request.method === 'editor' ? 5 : 2}
          disabled={busy}
          onChange={(event) => setValue(event.target.value)}
        />
      ) : null}

      <div className="absolute right-[-8px] bottom-[-2px] flex justify-end">
        <PiExtensionDialogActions
          busy={busy}
          method={request.method}
          onAnswer={(next) => void answer(next)}
          onSubmitTextValue={() => void submitTextValue()}
        />
      </div>
    </div>
  )

  return embedded ? content : <div className="grid w-full overflow-visible px-4">{content}</div>
}
