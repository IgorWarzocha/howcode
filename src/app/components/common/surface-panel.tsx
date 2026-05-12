import type { HTMLAttributes, PropsWithChildren, Ref } from 'react'
import { panelChromeClass } from '../../ui/classes'
import { cn } from '../../utils/cn'

type SurfacePanelProps = PropsWithChildren<
  HTMLAttributes<HTMLDivElement> & {
    className?: string
    ref?: Ref<HTMLDivElement> | undefined
  }
>

export function SurfacePanel({ className, children, ref, ...props }: SurfacePanelProps) {
  return (
    <div ref={ref} className={cn(panelChromeClass, className)} {...props}>
      {children}
    </div>
  )
}
