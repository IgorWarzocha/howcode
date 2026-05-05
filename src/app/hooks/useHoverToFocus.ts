import { type PointerEvent, type RefObject, useCallback, useEffect } from 'react'

const DEFAULT_HOVER_TOLERANCE_PX = 20

function isPointInsideRectWithTolerance({
  clientX,
  clientY,
  rect,
  tolerancePx,
}: {
  clientX: number
  clientY: number
  rect: DOMRect
  tolerancePx: number
}) {
  return (
    clientX >= rect.left - tolerancePx &&
    clientX <= rect.right + tolerancePx &&
    clientY >= rect.top - tolerancePx &&
    clientY <= rect.bottom + tolerancePx
  )
}

export function useHoverToFocus<T extends HTMLElement>({
  enabled,
  boundaryRef,
  targetRef,
  focus,
  blur,
  blurOnLeave = false,
  tolerancePx = DEFAULT_HOVER_TOLERANCE_PX,
  isFocused,
}: {
  enabled: boolean
  boundaryRef?: RefObject<HTMLElement | null>
  targetRef?: RefObject<T | null>
  focus: () => void
  blur?: () => void
  blurOnLeave?: boolean
  tolerancePx?: number
  isFocused?: () => boolean
}) {
  const ownsFocus = useCallback(() => {
    if (isFocused) {
      return isFocused()
    }

    return !!targetRef?.current && document.activeElement === targetRef.current
  }, [isFocused, targetRef])

  const focusIfNeeded = useCallback(() => {
    if (!ownsFocus()) {
      focus()
    }
  }, [focus, ownsFocus])

  const blurIfNeeded = useCallback(() => {
    if (blurOnLeave && ownsFocus()) {
      blur?.()
    }
  }, [blur, blurOnLeave, ownsFocus])

  useEffect(() => {
    if (!enabled) {
      return
    }

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      if (event.pointerType !== 'mouse') {
        return
      }

      const boundary = boundaryRef?.current ?? targetRef?.current
      if (!boundary) {
        return
      }

      const inside = isPointInsideRectWithTolerance({
        clientX: event.clientX,
        clientY: event.clientY,
        rect: boundary.getBoundingClientRect(),
        tolerancePx,
      })

      if (inside) {
        focusIfNeeded()
        return
      }

      blurIfNeeded()
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    return () => window.removeEventListener('pointermove', handlePointerMove)
  }, [blurIfNeeded, boundaryRef, enabled, focusIfNeeded, targetRef, tolerancePx])

  return useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!enabled || event.pointerType !== 'mouse') {
        return
      }

      focusIfNeeded()
    },
    [enabled, focusIfNeeded],
  )
}
