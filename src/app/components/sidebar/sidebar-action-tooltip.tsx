import { Tooltip } from '@howcode/common/tooltip'
import type { ReactNode } from 'react'

type SidebarActionTooltipProps = {
  description: string
  warning?: string | null | undefined
  children: ReactNode
}

export function SidebarActionTooltip({
  description,
  warning,
  children,
}: SidebarActionTooltipProps) {
  const describedAction = (
    <Tooltip content={description} placement="right">
      {children}
    </Tooltip>
  )

  if (!warning) return describedAction

  return (
    <Tooltip content={warning} placement="top" contentClassName="sidebar-action-warning-tooltip">
      {describedAction}
    </Tooltip>
  )
}
