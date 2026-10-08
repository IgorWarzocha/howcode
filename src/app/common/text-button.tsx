import { cn } from '@howaboua/howcode-sdk/utils/cn'
import { ghostButtonClass } from '@howcode/ui/classes'
import type { ButtonHTMLAttributes, PropsWithChildren, Ref } from 'react'

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
