import { type RefObject, useEffect, useEffectEvent } from 'react'

type DismissibleRef = RefObject<HTMLElement | null>

type UseDismissibleLayerOptions = {
  open: boolean
  onDismiss: () => void
  refs: DismissibleRef[]
  shouldDismissOnEscape?: ((event: KeyboardEvent) => boolean) | undefined
}

export function useDismissibleLayer({
  open,
  onDismiss,
  refs,
  shouldDismissOnEscape,
}: UseDismissibleLayerOptions) {
  const handlePointerDown = useEffectEvent((event: PointerEvent) => {
    const target = event.target as Node | null
    const clickedInside = refs.some((ref) => ref.current?.contains(target) ?? false)

    if (!clickedInside) {
      onDismiss()
    }
  })

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== 'Escape') return
    if (shouldDismissOnEscape && !shouldDismissOnEscape(event)) return

    event.preventDefault()
    event.stopImmediatePropagation()
    onDismiss()
  })

  useEffect(() => {
    if (!open) return

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown, true)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [open])
}
