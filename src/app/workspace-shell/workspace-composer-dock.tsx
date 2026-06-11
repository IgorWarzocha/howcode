import type { ReactNode } from 'react'
import { WORKSPACE_CONTENT_MAX_WIDTH_CLASS } from '../ui/layout'
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
  compactControls: _compactControls = false,
  leftClassName,
  rightClassName,
}: WorkspaceComposerDockProps) {
  return (
    <div
      className={cn(
        'relative mx-auto w-full [container-type:inline-size]',
        WORKSPACE_CONTENT_MAX_WIDTH_CLASS,
      )}
    >
      <div className="relative z-10 w-full">
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
            'absolute right-0 bottom-[calc(0.375rem+var(--composer-extension-status-height,0px))] z-20 min-w-0 translate-x-[calc(100%+0.5rem)]',
            rightClassName,
          )}
        >
          {right}
        </div>
      ) : null}
    </div>
  )
}
