import { cn } from '@howaboua/howcode-sdk/utils/cn'
import {
  compactMetaRowActionsClass,
  quietMetaRowClass,
  quietMetaRowDenseClass,
  quietMetaRowSelectedClass,
} from '@howcode/ui/classes'
import type { PropsWithChildren, ReactNode } from 'react'

type CompactMetaRowProps = PropsWithChildren<{
  actions?: ReactNode
  selected?: boolean
  density?: 'default' | 'dense'
  className?: string
  contentClassName?: string
}>

export function CompactMetaRow({
  actions,
  selected,
  density = 'default',
  className,
  contentClassName,
  children,
}: CompactMetaRowProps) {
  return (
    <div
      className={cn(
        density === 'dense' ? quietMetaRowDenseClass : quietMetaRowClass,
        selected && quietMetaRowSelectedClass,
        className,
      )}
    >
      <div className={cn('min-w-0', contentClassName)}>{children}</div>
      {actions ? <div className={compactMetaRowActionsClass}>{actions}</div> : null}
    </div>
  )
}
