import type { ReactNode } from 'react'
import { mainPanelClass } from '../ui/classes'
import { WORKSPACE_EDGE_PADDING_CLASS } from '../ui/layout'
import { cn } from '../utils/cn'

export function HostWorkspacePresentation({
  children,
  flush = false,
}: {
  children: ReactNode
  flush?: boolean
}) {
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <div
        className={cn(
          'motion-terminal-drawer-offset absolute inset-x-0 top-0 overflow-hidden',
          WORKSPACE_EDGE_PADDING_CLASS,
        )}
        style={{ bottom: '0px' }}
      >
        <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)] gap-3 overflow-hidden">
          <main className={flush ? 'min-h-0 overflow-hidden' : mainPanelClass}>{children}</main>
        </div>
      </div>
    </div>
  )
}
