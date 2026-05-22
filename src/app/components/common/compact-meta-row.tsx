import type { PropsWithChildren, ReactNode } from 'react'
import {
  compactMetaRowActionsClass,
  quietMetaRowClass,
  quietMetaRowSelectedClass,
} from '../../ui/classes'
import { cn } from '../../utils/cn'

type CompactMetaRowProps = PropsWithChildren<{
  actions?: ReactNode
  selected?: boolean
  className?: string
  contentClassName?: string
}>

export function CompactMetaRow({
  actions,
  selected,
  className,
  contentClassName,
  children,
}: CompactMetaRowProps) {
  return (
    <div className={cn(quietMetaRowClass, selected && quietMetaRowSelectedClass, className)}>
      <div className={cn('min-w-0', contentClassName)}>{children}</div>
      {actions ? <div className={compactMetaRowActionsClass}>{actions}</div> : null}
    </div>
  )
}
