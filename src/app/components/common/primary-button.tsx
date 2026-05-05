import { type ButtonHTMLAttributes, forwardRef, type PropsWithChildren } from 'react'
import { primaryButtonClass } from '../../ui/classes'
import { cn } from '../../utils/cn'

type PrimaryButtonProps = PropsWithChildren<
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
    className?: string
  }
>

export const PrimaryButton = forwardRef<HTMLButtonElement, PrimaryButtonProps>(
  function PrimaryButtonComponent(
    { onClick, className, children, type = 'button', title, ...buttonProps },
    ref,
  ) {
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
  },
)
