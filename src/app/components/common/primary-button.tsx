import type { ButtonHTMLAttributes, PropsWithChildren, Ref } from 'react'
import { primaryButtonClass } from '../../ui/classes'
import { cn } from '../../utils/cn'

type PrimaryButtonProps = PropsWithChildren<
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
    className?: string
    ref?: Ref<HTMLButtonElement> | undefined
  }
>

export function PrimaryButton({
  onClick,
  className,
  children,
  type = 'button',
  title,
  ref,
  ...buttonProps
}: PrimaryButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(primaryButtonClass, className)}
      onClick={onClick}
      data-tooltip={typeof title === 'string' ? title : undefined}
      {...buttonProps}
    >
      {children}
    </button>
  )
}
