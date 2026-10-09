import { type DockLayout, WorkspaceDock } from '@howaboua/howcode-sdk/workspace-dock'
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
  onLayoutChange,
}: {
  children: ReactNode
  footerInset: number
  detail?: ReactNode
  layout?: DockLayout
  detailLabel?: string
  onLayoutChange?: ((patch: Partial<DockLayout>) => void) | undefined
}) {
  return (
    <WorkspaceDock
      layout={layout}
      footerInset={footerInset}
      detailLabel={detailLabel ?? 'Workspace detail'}
      detail={detail}
      onLayoutChange={onLayoutChange}
    >
      {children}
    </WorkspaceDock>
  )
}
