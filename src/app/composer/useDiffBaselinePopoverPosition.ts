import { type RefObject, useLayoutEffect, useState } from 'react'

export const BASELINE_POPOVER_WIDTH = 400
export type BaselineAnchorKind = 'summary' | 'branch' | 'compact'

function getActiveBaselineAnchorRef(input: {
  activeAnchor: BaselineAnchorKind
  anchorRef: RefObject<HTMLButtonElement | null>
  branchAnchorRef: RefObject<HTMLButtonElement | null>
  compactAnchorRef: RefObject<HTMLButtonElement | null>
}) {
  if (input.activeAnchor === 'branch') return input.branchAnchorRef
  if (input.activeAnchor === 'compact') return input.compactAnchorRef
  return input.anchorRef
}

function getVisibleAnchorRect(anchorRef: RefObject<HTMLButtonElement | null>) {
  const element = anchorRef.current
  if (!element) return null
  const rect = element.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return null
  return rect
}

function getResponsiveAnchorRect(input: {
  activeAnchor: BaselineAnchorKind
  anchorRef: RefObject<HTMLButtonElement | null>
  branchAnchorRef: RefObject<HTMLButtonElement | null>
  compactAnchorRef: RefObject<HTMLButtonElement | null>
}) {
  const activeAnchorRect = getVisibleAnchorRect(getActiveBaselineAnchorRef(input))
  if (activeAnchorRect) return activeAnchorRect
  return (
    getVisibleAnchorRect(input.compactAnchorRef) ??
    getVisibleAnchorRect(input.branchAnchorRef) ??
    getVisibleAnchorRect(input.anchorRef)
  )
}

export function useDiffBaselinePopoverPosition({
  anchorRef,
  branchAnchorRef,
  compactAnchorRef,
  composerPanelRef,
  activeAnchorRef,
  open,
}: {
  anchorRef: RefObject<HTMLButtonElement | null>
  branchAnchorRef: RefObject<HTMLButtonElement | null>
  compactAnchorRef: RefObject<HTMLButtonElement | null>
  composerPanelRef: RefObject<HTMLDivElement | null>
  activeAnchorRef: RefObject<BaselineAnchorKind>
  open: boolean
}) {
  const [positionReady, setPositionReady] = useState(false)
  const [panelPosition, setPanelPosition] = useState({
    left: 16,
    bottom: 20,
    maxHeight: 360,
    width: BASELINE_POPOVER_WIDTH,
  })

  useLayoutEffect(() => {
    if (!open) {
      setPositionReady(false)
      return
    }

    const updatePosition = () => {
      const composerRect = composerPanelRef.current?.getBoundingClientRect()
      const anchorRect = getResponsiveAnchorRect({
        activeAnchor: activeAnchorRef.current,
        anchorRef,
        branchAnchorRef,
        compactAnchorRef,
      })
      if (!(composerRect && anchorRect)) return

      const viewportGutter = 8
      const width = Math.min(BASELINE_POPOVER_WIDTH, composerRect.width)
      const minLeft = viewportGutter
      const maxLeft = Math.max(minLeft, window.innerWidth - width - viewportGutter)
      const preferredLeft = composerRect.right - width
      const left = Math.min(Math.max(preferredLeft, minLeft), maxLeft)
      const bottom = Math.max(window.innerHeight - anchorRect.top + 8, viewportGutter)
      const maxHeight = Math.max(160, window.innerHeight - bottom - viewportGutter)

      setPanelPosition({ left, bottom, maxHeight, width })
      setPositionReady(true)
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [activeAnchorRef, anchorRef, branchAnchorRef, compactAnchorRef, composerPanelRef, open])

  return { panelPosition, positionReady }
}
