import { type RefObject, useLayoutEffect, useRef } from 'react'

function measureElementHeight(element: HTMLElement | null) {
  if (!element) return 0
  return Math.ceil(element.getBoundingClientRect().height)
}

/** Pushes thread content up via `composerOverlayHeight` (padding-bottom), like ask-questions / BTW. */
export function useComposerThreadOverlayHeight(input: {
  extensionOverlayRef: RefObject<HTMLDivElement | null>
  extensionOverlayVisible: boolean
  popoverStackRef: RefObject<HTMLDivElement | null>
  popoverStackVisible: boolean
  onOverlayHeightChange?: ((height: number) => void) | undefined
}) {
  const { extensionOverlayRef, extensionOverlayVisible, popoverStackRef, popoverStackVisible } =
    input
  const lastReportedRef = useRef(0)

  useLayoutEffect(() => {
    const reportIfChanged = () => {
      const extensionHeight = extensionOverlayVisible
        ? measureElementHeight(extensionOverlayRef.current)
        : 0
      const popoverHeight = popoverStackVisible ? measureElementHeight(popoverStackRef.current) : 0
      const nextHeight = extensionHeight + popoverHeight
      if (lastReportedRef.current === nextHeight) return
      lastReportedRef.current = nextHeight
      input.onOverlayHeightChange?.(nextHeight)
    }

    if (!(extensionOverlayVisible || popoverStackVisible)) {
      if (lastReportedRef.current !== 0) {
        lastReportedRef.current = 0
        input.onOverlayHeightChange?.(0)
      }
      return
    }

    reportIfChanged()

    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(reportIfChanged)
    if (extensionOverlayVisible && extensionOverlayRef.current) {
      observer.observe(extensionOverlayRef.current)
    }
    if (popoverStackVisible && popoverStackRef.current) {
      observer.observe(popoverStackRef.current)
    }
    return () => observer.disconnect()
  }, [
    extensionOverlayRef,
    extensionOverlayVisible,
    input.onOverlayHeightChange,
    popoverStackRef,
    popoverStackVisible,
  ])
}
