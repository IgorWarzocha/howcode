import type { HTMLAttributes, PropsWithChildren, Ref } from 'react'
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
