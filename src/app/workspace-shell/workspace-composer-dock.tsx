import type { ReactNode } from 'react'
import { WORKSPACE_COMPOSER_CENTER_GRID_CLASS } from '../ui/layout'
import { cn } from '../utils/cn'

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
  return (
    <div
      className={cn(
        'grid w-full items-end [container-type:inline-size]',
        WORKSPACE_COMPOSER_CENTER_GRID_CLASS,
      )}
    >
      <div
        className={cn(
          'relative z-10 col-start-2 w-full',
          compactControls && '[--composer-overlay-compact-right-inset:0.5rem]',
        )}
      >
        {left ? (
          <div
            className={cn(
              'absolute bottom-[calc(0.5rem+var(--composer-extension-status-height,0px))] left-0 z-20 min-w-0',
              leftClassName,
            )}
          >
            {left}
          </div>
        ) : null}
        {center}
      </div>
      {right ? (
        <div
          className={cn(
            'relative z-20 col-start-3 mb-[calc(0.375rem+var(--composer-extension-status-height,0px))] min-w-0 justify-self-start self-end',
            rightClassName,
          )}
        >
          {right}
        </div>
      ) : null}
    </div>
  )
}
