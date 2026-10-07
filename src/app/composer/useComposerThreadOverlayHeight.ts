import { type RefObject, useLayoutEffect, useRef } from 'react'

function measureElementHeight(element: HTMLElement | null) {
  if (!element) return 0
  return Math.ceil(element.getBoundingClientRect().height)
}

/** Reserves transcript space for visible composer overlays. */
export function useComposerThreadOverlayHeight(input: {
  overlayRef: RefObject<HTMLDivElement | null>
  overlayVisible: boolean
  popoverStackRef: RefObject<HTMLDivElement | null>
  popoverStackVisible: boolean
  onOverlayHeightChange?: ((height: number) => void) | undefined
}) {
  const { overlayRef, overlayVisible, popoverStackRef, popoverStackVisible } = input
  const lastReportedRef = useRef(0)

  useLayoutEffect(() => {
    const reportIfChanged = () => {
      const overlayHeight = overlayVisible ? measureElementHeight(overlayRef.current) : 0
      const popoverHeight = popoverStackVisible ? measureElementHeight(popoverStackRef.current) : 0
      const nextHeight = overlayHeight + popoverHeight
      if (lastReportedRef.current === nextHeight) return
      lastReportedRef.current = nextHeight
      input.onOverlayHeightChange?.(nextHeight)
    }

    if (!(overlayVisible || popoverStackVisible)) {
      if (lastReportedRef.current !== 0) {
        lastReportedRef.current = 0
        input.onOverlayHeightChange?.(0)
      }
      return
    }

    reportIfChanged()

    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(reportIfChanged)
    if (overlayVisible && overlayRef.current) {
      observer.observe(overlayRef.current)
    }
    if (popoverStackVisible && popoverStackRef.current) {
      observer.observe(popoverStackRef.current)
    }
    return () => observer.disconnect()
  }, [
    overlayRef,
    overlayVisible,
    input.onOverlayHeightChange,
    popoverStackRef,
    popoverStackVisible,
  ])
}
