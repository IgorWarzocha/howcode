import { cn } from '@howaboua/howcode-sdk/utils/cn'
import { viewShellClass } from '@howcode/ui/classes'
import type { PropsWithChildren } from 'react'

type ViewShellProps = PropsWithChildren<{
  className?: string
  maxWidthClassName?: string
}>

export function ViewShell({
  children,
  className,
  maxWidthClassName = 'max-w-[860px]',
}: ViewShellProps) {
  return <div className={cn(viewShellClass, maxWidthClassName, className)}>{children}</div>
}
