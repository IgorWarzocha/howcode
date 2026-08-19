import { Check, Clipboard } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  appToneMutedClass,
  appTypeCodeClass,
  appTypeGroupTextClass,
  appTypeMetaStrongClass,
  composerPopoverExtensionLayerClass,
} from '../../ui/classes'
import { cn } from '../../utils/cn'

export function GitOpsErrorDetails({
  detail,
  onDismiss,
}: {
  detail: string
  onDismiss: () => void
}) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const helperText =
    copyState === 'failed' ? '- copy failed, press Escape to dismiss' : '- click copy to dismiss'

  useEffect(() => {
    if (copyState === 'idle') return
    const timeout = window.setTimeout(() => setCopyState('idle'), 1400)
    return () => window.clearTimeout(timeout)
  }, [copyState])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onDismiss()
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [onDismiss])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(detail)
      setCopyState('copied')
      onDismiss()
    } catch {
      setCopyState('failed')
    }
  }

  return (
    <div
      className={cn(
        'pointer-events-auto absolute inset-x-0 bottom-[calc(100%+0.75rem)]',
        composerPopoverExtensionLayerClass,
      )}
      role="alert"
      aria-live="polite"
    >
      <div
        className={cn(
          'group relative rounded-lg bg-[color:color-mix(in_srgb,var(--danger-bg)_55%,var(--panel))] px-3 py-2 pr-12',
          appTypeGroupTextClass,
        )}
      >
        <div className="grid gap-1">
          <div className="flex items-center gap-2 text-[color:var(--danger)]">
            <span className="h-2 w-2 rounded-full bg-[color:var(--danger)]" />
            <span>GitOps action failed</span>
            <span className="text-[color:var(--muted)]">{helperText}</span>
          </div>
          <div className={cn('whitespace-pre-wrap', appTypeCodeClass, appToneMutedClass)}>
            {detail}
          </div>
        </div>
        <button
          type="button"
          className={cn(
            'absolute top-1.5 right-1.5 grid h-8 min-w-8 place-items-center rounded-md bg-[color:var(--surface-hover)] px-2 opacity-75 transition-[opacity,scale,background-color,color] duration-150 ease-out hover:bg-[color:var(--folded-row-hover-bg)] hover:text-[color:var(--text)] hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-border)] active:scale-[0.96] group-hover:opacity-100',
            appTypeMetaStrongClass,
            appToneMutedClass,
          )}
          onClick={() => void handleCopy()}
          aria-label={copyState === 'copied' ? 'Copied git error' : 'Copy git error'}
          title={
            copyState === 'failed' ? 'Copy failed' : copyState === 'copied' ? 'Copied' : 'Copy'
          }
        >
          {copyState === 'copied' ? <Check size={14} /> : <Clipboard size={14} />}
        </button>
      </div>
    </div>
  )
}
