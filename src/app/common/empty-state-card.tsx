import { cn } from '@howaboua/howcode-sdk/utils/cn'
import { quietEmptyStateClass } from '@howcode/ui/classes'
import type { PropsWithChildren } from 'react'

type EmptyStateCardProps = PropsWithChildren<{
  className?: string
}>

export function EmptyStateCard({ children, className }: EmptyStateCardProps) {
  return <div className={cn(quietEmptyStateClass, className)}>{children}</div>
}
