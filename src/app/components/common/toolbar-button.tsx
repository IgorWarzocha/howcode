import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { toolbarButtonClass } from '../../ui/classes'
import { cn } from '../../utils/cn'

type ToolbarButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  label: ReactNode
  icon: ReactNode
  tooltip?: string
  trailing?: boolean
  ref?: Ref<HTMLButtonElement> | undefined
}

export function ToolbarButton({
  label,
  icon,
  tooltip,
  onClick,
  trailing,
  className,
  type = 'button',
  ref,
  ...buttonProps
}: ToolbarButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(toolbarButtonClass, className)}
      onClick={onClick}
      data-tooltip={tooltip ?? (typeof label === 'string' ? label : undefined)}
      {...buttonProps}
    >
      {trailing ? null : icon}
      <span>{label}</span>
      {trailing ? icon : null}
    </button>
  )
}
