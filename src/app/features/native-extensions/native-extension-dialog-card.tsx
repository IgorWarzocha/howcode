import { Check, X } from 'lucide-react'
import { useState } from 'react'
import type { NativeExtensionDialogRequest } from '../../desktop/types'
import {
  appToneMutedClass,
  appToneTextClass,
  appTypeGroupTextClass,
  appTypeMetaClass,
  appTypeTinyClass,
} from '../../ui/classes'
import { cn } from '../../utils/cn'

type NativeExtensionDialogCardProps = {
  request: NativeExtensionDialogRequest
  onAnswer: (answer: {
    cancelled?: boolean | undefined
    confirmed?: boolean | undefined
    value?: string | undefined
  }) => Promise<boolean> | boolean
}

const nativeExtensionDialogCardClass =
  'relative grid w-full content-start gap-2 rounded-t-lg rounded-b-none border border-[color:var(--border)] bg-[color:var(--panel)] px-5 py-3 shadow-none'

export function NativeExtensionDialogCard({ request, onAnswer }: NativeExtensionDialogCardProps) {
  const [busy, setBusy] = useState(false)
  const [value, setValue] = useState(request.prefill ?? '')

  const answer = async (next: Parameters<NativeExtensionDialogCardProps['onAnswer']>[0]) => {
    if (busy) return
    setBusy(true)
    const ok = await onAnswer(next)
    if (!ok) setBusy(false)
  }

  return (
    <div className="grid w-full overflow-visible px-4">
      <div className={nativeExtensionDialogCardClass}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
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

          <button
            type="button"
            aria-label="Cancel extension UI request"
            title="Cancel"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--muted)] transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] disabled:opacity-55"
            disabled={busy}
            onClick={() => void answer({ cancelled: true })}
          >
            <X size={13} />
          </button>
        </div>

        {request.method === 'select' ? (
          <div className="flex flex-wrap gap-1.5">
            {(request.options ?? []).map((option) => (
              <button
                key={option}
                type="button"
                className={cn(
                  'inline-flex min-h-7 items-center rounded-md bg-[color:var(--surface-hover)] px-2.5 text-[color:var(--text)] transition-colors hover:bg-[color:var(--panel-3)] disabled:opacity-55',
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

        {request.method === 'select' ? null : (
          <div className="flex justify-end gap-1.5">
            {request.method === 'confirm' ? (
              <>
                <button
                  type="button"
                  aria-label="Reject"
                  title="Reject"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--muted)] transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] disabled:opacity-55"
                  disabled={busy}
                  onClick={() => void answer({ confirmed: false })}
                >
                  <X size={13} />
                </button>
                <button
                  type="button"
                  aria-label="Accept"
                  title="Accept"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[color:var(--surface-hover)] text-[color:var(--text)] transition-colors hover:bg-[color:var(--panel-3)] disabled:opacity-55"
                  disabled={busy}
                  onClick={() => void answer({ confirmed: true })}
                >
                  <Check size={13} />
                </button>
              </>
            ) : (
              <button
                type="button"
                aria-label="Submit"
                title="Submit"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[color:var(--surface-hover)] text-[color:var(--text)] transition-colors hover:bg-[color:var(--panel-3)] disabled:opacity-55"
                disabled={busy}
                onClick={() => void answer({ value })}
              >
                <Check size={13} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
