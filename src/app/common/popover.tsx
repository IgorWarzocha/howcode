import type { CSSProperties, HTMLAttributes, PropsWithChildren, Ref, RefObject } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../utils/cn'
import {
  type AnchoredPopoverPlacement,
  getPopoverBoundaryProps,
  getPopoverRootProps,
  useAnchoredPopoverPosition,
} from './popover-state'
import { SurfacePanel } from './surface-panel'

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

type PopoverPortalLayerProps = PropsWithChildren<{
  className?: string | undefined
  style?: CSSProperties | undefined
}>

function PopoverPortalLayer({ children, className, style }: PopoverPortalLayerProps) {
  return (
    <div className={cn('pointer-events-none fixed inset-0 z-[300]', className)} style={style}>
      {children}
    </div>
  )
}

type AnchoredPopoverPanelProps = PropsWithChildren<
  HTMLAttributes<HTMLDivElement> & {
    anchorRef: RefObject<HTMLElement | null>
    panelRef: RefObject<HTMLDivElement | null>
    open: boolean
    placement?: AnchoredPopoverPlacement | undefined
    gap?: number | undefined
    viewportPadding?: number | undefined
    portalClassName?: string | undefined
    surface?: boolean | undefined
  }
>

export function AnchoredPopoverPanel({
  anchorRef,
  panelRef,
  open,
  placement = 'top-start',
  gap,
  viewportPadding,
  portalClassName,
  surface = false,
  children,
  className,
  style,
  ...props
}: AnchoredPopoverPanelProps) {
  const { position, positionReady } = useAnchoredPopoverPosition({
    anchorRef,
    panelRef,
    enabled: open,
    placement,
    gap,
    viewportPadding,
  })

  if (!(open && typeof document !== 'undefined')) return null

  return createPortal(
    <PopoverPortalLayer className={portalClassName}>
      <PopoverPanel
        ref={panelRef}
        open={positionReady}
        surface={surface}
        data-open={positionReady ? 'true' : 'false'}
        className={cn(
          'motion-popover pointer-events-auto fixed transition-opacity duration-150 ease-out',
          !positionReady && 'pointer-events-none opacity-0',
          className,
        )}
        style={{ ...style, left: `${position.left}px`, top: `${position.top}px` }}
        {...props}
      >
        {children}
      </PopoverPanel>
    </PopoverPortalLayer>,
    document.body,
  )
}
