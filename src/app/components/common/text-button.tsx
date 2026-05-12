import type { ButtonHTMLAttributes, PropsWithChildren, Ref } from 'react'
import { ghostButtonClass } from '../../ui/classes'
import { cn } from '../../utils/cn'

type TextButtonProps = PropsWithChildren<
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
    className?: string
    ref?: Ref<HTMLButtonElement> | undefined
  }
>

export function TextButton({
  onClick,
  className,
  children,
  type = 'button',
  title,
  ref,
  ...buttonProps
}: TextButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(ghostButtonClass, className)}
      onClick={onClick}
      data-tooltip={typeof title === 'string' ? title : undefined}
      {...buttonProps}
    >
      {children}
    </button>
  )
}
