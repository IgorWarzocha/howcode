import type { HTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

export function SkeletonBlock({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn('skeleton-block', className)} {...props} />
}
