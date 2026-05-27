import { useEffect, useState } from 'react'

export type ComposerPopoverSource = 'context' | 'dashboard-branch' | 'diff-baseline' | 'model'

const COMPOSER_POPOVER_OPEN_EVENT = 'howcode:composer-popover-open'

type ComposerPopoverOpenEvent = CustomEvent<{ source: ComposerPopoverSource }>

export function notifyComposerPopoverOpened(source: ComposerPopoverSource) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(COMPOSER_POPOVER_OPEN_EVENT, { detail: { source } }))
}

export function useComposerPopoverDismissSignal(input?: {
  ignoreSource?: ComposerPopoverSource | undefined
  onDismiss?: ((source: ComposerPopoverSource) => void) | undefined
}) {
  const [dismissSignal, setDismissSignal] = useState(0)

  useEffect(() => {
    const handlePopoverOpen = (event: Event) => {
      const source = (event as ComposerPopoverOpenEvent).detail?.source
      if (!source || source === input?.ignoreSource) return
      input?.onDismiss?.(source)
      setDismissSignal((value) => value + 1)
    }

    window.addEventListener(COMPOSER_POPOVER_OPEN_EVENT, handlePopoverOpen)
    return () => window.removeEventListener(COMPOSER_POPOVER_OPEN_EVENT, handlePopoverOpen)
  }, [input])

  return dismissSignal
}
