import type { HTMLAttributes, PropsWithChildren } from 'react'
import { cn } from '../../utils/cn'

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
