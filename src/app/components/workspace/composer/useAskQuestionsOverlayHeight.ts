import { type RefObject, useLayoutEffect, useRef } from 'react'

export function useAskQuestionsOverlayHeight({
  overlayRef,
  visible,
  onOverlayHeightChange,
}: {
  overlayRef: RefObject<HTMLDivElement | null>
  visible: boolean
  onOverlayHeightChange?: ((height: number) => void) | undefined
}) {
  const lastOverlayHeightRef = useRef(0)

  useLayoutEffect(() => {
    if (!visible) {
      if (lastOverlayHeightRef.current !== 0) {
        lastOverlayHeightRef.current = 0
        onOverlayHeightChange?.(0)
      }
      return
    }

    const overlay = overlayRef.current
    if (!overlay) return

    const reportIfChanged = () => {
      const nextHeight = Math.ceil(overlay.getBoundingClientRect().height)
      if (lastOverlayHeightRef.current === nextHeight) return
      lastOverlayHeightRef.current = nextHeight
      onOverlayHeightChange?.(nextHeight)
    }

    reportIfChanged()

    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(reportIfChanged)
    observer.observe(overlay)
    return () => observer.disconnect()
  }, [onOverlayHeightChange, overlayRef, visible])
}
