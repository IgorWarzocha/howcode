import {
  type CSSProperties,
  type HTMLAttributes,
  type PropsWithChildren,
  type Ref,
  type RefObject,
  useLayoutEffect,
  useState,
} from 'react'
import { cn } from '../../utils/cn'
import { SurfacePanel } from './surface-panel'

export const popoverBoundaryAttribute = 'data-popover-boundary'
export const popoverOpenAttribute = 'data-popover-open'

export function getPopoverRootProps(open: boolean) {
  return {
    [popoverOpenAttribute]: open ? 'true' : undefined,
  }
}

export function getPopoverBoundaryProps() {
  return {
    [popoverBoundaryAttribute]: 'true',
  }
}

type PopoverBoundaryProps = PropsWithChildren<HTMLAttributes<HTMLElement>> & {
  as?: 'div' | 'section' | 'span'
}

export function PopoverBoundary({
  as: Component = 'div',
  children,
  className,
  ...props
}: PopoverBoundaryProps) {
  return (
    <Component {...getPopoverBoundaryProps()} className={className} {...props}>
      {children}
    </Component>
  )
}

type PopoverRootProps = PropsWithChildren<HTMLAttributes<HTMLSpanElement>> & {
  open: boolean
}

export function PopoverRoot({ open, children, className, ...props }: PopoverRootProps) {
  return (
    <span
      {...getPopoverRootProps(open)}
      className={cn('relative block max-w-full', className)}
      {...props}
    >
      {children}
    </span>
  )
}

type PopoverPanelProps = PropsWithChildren<
  HTMLAttributes<HTMLDivElement> & {
    open?: boolean | undefined
    ref?: Ref<HTMLDivElement> | undefined
    surface?: boolean | undefined
  }
>

export function PopoverPanel({
  open = true,
  surface = true,
  children,
  className,
  ref,
  ...props
}: PopoverPanelProps) {
  const panelProps = {
    ...getPopoverRootProps(open),
    className: cn(className),
    ...props,
  }

  if (!surface) {
    return (
      <div ref={ref} {...panelProps}>
        {children}
      </div>
    )
  }

  return (
    <SurfacePanel ref={ref} {...panelProps}>
      {children}
    </SurfacePanel>
  )
}

export type AnchoredPopoverPlacement = 'top-start' | 'bottom-start' | 'right'

type UseAnchoredPopoverPositionInput = {
  anchorRef: RefObject<HTMLElement | null>
  panelRef: RefObject<HTMLElement | null>
  enabled: boolean
  placement?: AnchoredPopoverPlacement | undefined
  gap?: number | undefined
  viewportPadding?: number | undefined
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getAnchoredPopoverPosition(input: {
  anchorRect: DOMRect
  panelRect: DOMRect
  placement: AnchoredPopoverPlacement
  gap: number
  viewportPadding: number
}) {
  const { anchorRect, gap, panelRect, placement, viewportPadding } = input
  const maxLeft = window.innerWidth - panelRect.width - viewportPadding
  const maxTop = window.innerHeight - panelRect.height - viewportPadding

  if (placement === 'right') {
    const preferredLeft = anchorRect.right + gap
    const centeredTop = anchorRect.top + anchorRect.height / 2 - panelRect.height / 2
    return {
      left: clamp(preferredLeft, viewportPadding, Math.max(viewportPadding, maxLeft)),
      top: clamp(centeredTop, viewportPadding, Math.max(viewportPadding, maxTop)),
    }
  }

  const preferredLeft = anchorRect.left
  const topPlacement = placement === 'top-start'
  const preferredTop = topPlacement
    ? anchorRect.top - panelRect.height - gap
    : anchorRect.bottom + gap
  const fallbackTop = topPlacement
    ? anchorRect.bottom + gap
    : anchorRect.top - panelRect.height - gap

  return {
    left: clamp(preferredLeft, viewportPadding, Math.max(viewportPadding, maxLeft)),
    top: clamp(
      preferredTop >= viewportPadding && preferredTop <= maxTop ? preferredTop : fallbackTop,
      viewportPadding,
      Math.max(viewportPadding, maxTop),
    ),
  }
}

export function useAnchoredPopoverPosition({
  anchorRef,
  panelRef,
  enabled,
  placement = 'top-start',
  gap = 8,
  viewportPadding = 12,
}: UseAnchoredPopoverPositionInput) {
  const [position, setPosition] = useState({ left: 0, top: 0 })
  const [positionReady, setPositionReady] = useState(false)

  useLayoutEffect(() => {
    if (!enabled) {
      setPositionReady(false)
      return
    }

    const updatePosition = (event?: Event) => {
      const target = event?.target instanceof Node ? event.target : null
      if (target && panelRef.current?.contains(target)) return

      const anchorRect = anchorRef.current?.getBoundingClientRect()
      const panelRect = panelRef.current?.getBoundingClientRect()
      if (!(anchorRect && panelRect)) return

      const nextPosition = getAnchoredPopoverPosition({
        anchorRect,
        panelRect,
        placement,
        gap,
        viewportPadding,
      })
      setPosition((current) =>
        current.left === nextPosition.left && current.top === nextPosition.top
          ? current
          : nextPosition,
      )
      setPositionReady(true)
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [anchorRef, enabled, gap, panelRef, placement, viewportPadding])

  return { position, positionReady }
}

type PopoverPortalLayerProps = PropsWithChildren<{
  className?: string | undefined
  style?: CSSProperties | undefined
}>

export function PopoverPortalLayer({ children, className, style }: PopoverPortalLayerProps) {
  return (
    <div className={cn('pointer-events-none fixed inset-0 z-[300]', className)} style={style}>
      {children}
    </div>
  )
}
