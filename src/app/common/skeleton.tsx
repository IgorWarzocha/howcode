import { cn } from '@howaboua/howcode-sdk/utils/cn'
import type { HTMLAttributes } from 'react'

export function SkeletonBlock({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn('skeleton-block', className)} {...props} />
}
