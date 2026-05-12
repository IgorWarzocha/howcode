import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { iconButtonClass } from '../../ui/classes'
import { cn } from '../../utils/cn'
import { Tooltip } from './tooltip'

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  label: string
  icon: ReactNode
  active?: boolean
  tooltip?: string | null
  tooltipPlacement?: 'top' | 'right' | 'left'
  ref?: Ref<HTMLButtonElement> | undefined
}

export function IconButton({
  label,
  icon,
  tooltip,
  tooltipPlacement,
  onClick,
  active,
  className,
  type = 'button',
  ref,
  ...buttonProps
}: IconButtonProps) {
  const button = (
    <button
      ref={ref}
      type={type}
      className={cn(
        iconButtonClass,
        active &&
          'bg-[rgba(183,186,245,0.09)] text-[color:var(--text)] shadow-[inset_0_0_0_1px_rgba(183,186,245,0.03)]',
        className,
      )}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active || undefined}
      {...buttonProps}
    >
      {icon}
    </button>
  )

  if (tooltip === null) {
    return button
  }

  return (
    <Tooltip content={tooltip ?? label} placement={tooltipPlacement}>
      {button}
    </Tooltip>
  )
}
