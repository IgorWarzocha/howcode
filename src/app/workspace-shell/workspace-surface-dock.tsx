import { type DockLayout, WorkspaceDock } from '@howaboua/howcode-sdk/workspace-dock'
import {
  useWorkspaceSurface,
  WorkspaceSurfaceAnchor,
} from '@howaboua/howcode-sdk/workspace-surfaces'
import type { ReactNode } from 'react'

const DEFAULT_LAYOUT: DockLayout = {
  placement: 'main',
  sidebarWidth: 480,
  floatingWidth: 700,
  floatingHeight: 500,
  floatingX: 50,
  floatingY: 50,
}

/** Both chat presentations keep their composer and timeline in the same stable dock column. */
export function WorkspaceSurfaceDock({
  children,
  footerInset,
  detail,
  layout = DEFAULT_LAYOUT,
  detailLabel,
}: {
  children: ReactNode
  footerInset: number
  detail?: ReactNode
  layout?: DockLayout
  detailLabel?: string
}) {
  const surface = useWorkspaceSurface()
  return (
    <WorkspaceDock
      layout={
        surface
          ? {
              ...DEFAULT_LAYOUT,
              placement: surface.placement === 'inline' ? 'main' : surface.placement,
              floatingX: surface.floatingX,
              floatingY: surface.floatingY,
            }
          : layout
      }
      footerInset={footerInset}
      detailLabel={surface?.title ?? detailLabel ?? 'Workspace detail'}
      detail={
        detail || surface ? (
          <>
            {detail ? (
              <div
                className="flex h-full min-h-0 flex-col"
                style={surface ? { display: 'none' } : undefined}
              >
                {detail}
              </div>
            ) : null}
            {surface ? <WorkspaceSurfaceAnchor /> : null}
          </>
        ) : null
      }
    >
      {children}
    </WorkspaceDock>
  )
}
