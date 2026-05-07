import type { CSSProperties, ReactNode } from 'react'
import { cn } from '../../utils/cn'

type WorkspaceComposerDockProps = {
  left?: ReactNode
  center: ReactNode
  right?: ReactNode
  compactControls?: boolean
  leftClassName?: string
  rightClassName?: string
}

export function WorkspaceComposerDock({
  left,
  center,
  right,
  compactControls = false,
  leftClassName,
  rightClassName,
}: WorkspaceComposerDockProps) {
  const dockStyle = {
    '--dock-left-lane': 'max(2rem, calc((100cqw - 800px - 1rem) / 2))',
  } as CSSProperties
  const leftStyle = compactControls
    ? undefined
    : ({
        transform: 'translateX(max(0px, calc(3.75rem - var(--dock-left-lane))))',
      } as CSSProperties)
  const rightStyle = compactControls
    ? undefined
    : ({
        transform: 'translateX(min(0px, calc(var(--dock-left-lane) - 3.75rem)))',
      } as CSSProperties)

  return (
    <div
      className="grid w-full grid-cols-[minmax(2rem,1fr)_minmax(0,800px)_minmax(2rem,1fr)] items-end gap-2 [container-type:inline-size]"
      style={dockStyle}
    >
      {left ? (
        <div
          className={cn(
            compactControls
              ? 'relative z-20 mb-1.5 min-w-0 translate-x-10 justify-self-end self-end'
              : 'relative z-20 mb-1.5 ml-3 min-w-0 self-end transition-transform duration-100 ease-out',
            leftClassName,
          )}
          style={leftStyle}
        >
          {left}
        </div>
      ) : null}
      <div className="relative z-10 col-start-2 w-full">{center}</div>
      {right ? (
        <div
          className={cn(
            compactControls
              ? 'relative z-20 col-start-3 mb-1.5 min-w-0 self-end'
              : 'relative z-20 col-start-3 mb-1.5 min-w-0 self-end transition-transform duration-100 ease-out',
            rightClassName,
          )}
          style={rightStyle}
        >
          {right}
        </div>
      ) : null}
    </div>
  )
}
