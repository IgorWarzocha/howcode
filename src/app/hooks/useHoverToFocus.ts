import { type PointerEvent, type RefObject, useEffect, useEffectEvent } from 'react'

const DEFAULT_HOVER_TOLERANCE_PX = 20
const EMPTY_BOUNDARY_REFS: readonly RefObject<HTMLElement | null>[] = []

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

function elementContainsPointTarget(element: HTMLElement, event: globalThis.PointerEvent) {
  const target = document.elementFromPoint(event.clientX, event.clientY)
  return target === null || element.contains(target)
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
  extraBoundaryRefs = EMPTY_BOUNDARY_REFS,
}: {
  enabled: boolean
  boundaryRef?: RefObject<HTMLElement | null>
  targetRef?: RefObject<T | null>
  focus: () => void
  blur?: () => void
  blurOnLeave?: boolean
  tolerancePx?: number
  isFocused?: () => boolean
  extraBoundaryRefs?: readonly RefObject<HTMLElement | null>[]
}) {
  const ownsFocus = () => {
    if (isFocused) {
      return isFocused()
    }

    return !!targetRef?.current && document.activeElement === targetRef.current
  }

  const focusIfNeeded = () => {
    if (!ownsFocus()) {
      focus()
    }
  }

  const blurIfNeeded = () => {
    if (blurOnLeave && ownsFocus()) {
      blur?.()
    }
  }

  const handlePointerMove = useEffectEvent((event: globalThis.PointerEvent) => {
    if (!enabled || event.pointerType !== 'mouse') return

    const boundary = boundaryRef?.current ?? targetRef?.current
    if (!boundary) return

    const inside = [boundary, ...extraBoundaryRefs.map((ref) => ref.current)].some(
      (element) =>
        element &&
        elementContainsPointTarget(element, event) &&
        isPointInsideRectWithTolerance({
          clientX: event.clientX,
          clientY: event.clientY,
          rect: element.getBoundingClientRect(),
          tolerancePx,
        }),
    )

    if (inside) {
      focusIfNeeded()
      return
    }

    blurIfNeeded()
  })

  useEffect(() => {
    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    return () => window.removeEventListener('pointermove', handlePointerMove)
  }, [])

  return (event: PointerEvent<HTMLElement>) => {
    if (!enabled || event.pointerType !== 'mouse') return
    focusIfNeeded()
  }
}
