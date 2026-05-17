import { type RefObject, useLayoutEffect, useState } from 'react'

const sidePlacementGap = 8
const sidePlacementViewportPadding = 12

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function useComposerModelPopoverPlacement({
  anchorRef,
  panelRef,
  preferSidePlacement,
}: {
  anchorRef: RefObject<HTMLButtonElement | null>
  panelRef: RefObject<HTMLDivElement | null>
  preferSidePlacement: boolean
}) {
  const [sidePlacementEnabled, setSidePlacementEnabled] = useState(false)
  const [sidePosition, setSidePosition] = useState({ left: 0, top: 0 })
  const [sidePositionReady, setSidePositionReady] = useState(false)

  useLayoutEffect(() => {
    const updatePlacementMode = () => {
      const anchorRect = anchorRef.current?.getBoundingClientRect()
      const estimatedPanelHeight = Math.min(
        360,
        window.innerHeight - sidePlacementViewportPadding * 2,
      )
      setSidePlacementEnabled(
        Boolean(
          anchorRect &&
            (preferSidePlacement ||
              anchorRect.top <
                estimatedPanelHeight + sidePlacementGap + sidePlacementViewportPadding),
        ),
      )
    }

    updatePlacementMode()
    window.addEventListener('resize', updatePlacementMode)
    window.addEventListener('scroll', updatePlacementMode, true)
    return () => {
      window.removeEventListener('resize', updatePlacementMode)
      window.removeEventListener('scroll', updatePlacementMode, true)
    }
  }, [anchorRef, preferSidePlacement])

  useLayoutEffect(() => {
    if (!sidePlacementEnabled) {
      setSidePositionReady(false)
      return
    }

    const updatePosition = (event?: Event) => {
      const target = event?.target instanceof Node ? event.target : null
      if (target && panelRef.current?.contains(target)) return

      const anchorRect = anchorRef.current?.getBoundingClientRect()
      const panelRect = panelRef.current?.getBoundingClientRect()
      if (!(anchorRect && panelRect)) return

      const maxLeft = window.innerWidth - panelRect.width - sidePlacementViewportPadding
      const preferredLeft = anchorRect.right + sidePlacementGap
      const left = clamp(
        preferredLeft,
        sidePlacementViewportPadding,
        Math.max(sidePlacementViewportPadding, maxLeft),
      )
      const maxTop = window.innerHeight - panelRect.height - sidePlacementViewportPadding
      const centeredTop = anchorRect.top + anchorRect.height / 2 - panelRect.height / 2
      const top = clamp(
        centeredTop,
        sidePlacementViewportPadding,
        Math.max(sidePlacementViewportPadding, maxTop),
      )

      setSidePosition((current) =>
        current.left === left && current.top === top ? current : { left, top },
      )
      setSidePositionReady(true)
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  })

  return { sidePlacementEnabled, sidePosition, sidePositionReady }
}
