import { forwardRef, type HTMLAttributes, type PropsWithChildren } from 'react'
import { panelChromeClass } from '../../ui/classes'
import { cn } from '../../utils/cn'

type SurfacePanelProps = PropsWithChildren<
  HTMLAttributes<HTMLDivElement> & {
    className?: string
  }
>

export const SurfacePanel = forwardRef<HTMLDivElement, SurfacePanelProps>(
  function SurfacePanelComponent({ className, children, ...props }, ref) {
    return (
      <div ref={ref} className={cn(panelChromeClass, className)} {...props}>
        {children}
      </div>
    )
  },
)
