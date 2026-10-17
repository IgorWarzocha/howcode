import { type DockLayout, WorkspaceDock } from '@howaboua/howcode-sdk/workspace-dock'
import type { ReactNode } from 'react'
import { WorkspaceLayoutControls } from './workspace-layout-controls'

const DEFAULT_LAYOUT: DockLayout = {
  placement: 'main',
  sidebarWidth: 480,
  floatingWidth: 700,
  floatingHeight: 500,
  floatingX: 50,
  floatingY: 50,
}

/** Keep the composer and timeline in one stable dock column. */
export function WorkspaceSurfaceDock({
  children,
  footerInset,
  detail,
  layout = DEFAULT_LAYOUT,
  detailLabel,
  onLayoutChange,
  conversationId,
}: {
  children: ReactNode
  footerInset: number
  detail?: ReactNode
  layout?: DockLayout
  detailLabel?: string
  onLayoutChange?: ((patch: Partial<DockLayout>) => void) | undefined
  conversationId: string | null
}) {
  return (
    <>
      <WorkspaceDock
        layout={layout}
        footerInset={footerInset}
        detailLabel={detailLabel ?? 'Workspace detail'}
        detail={detail}
        onLayoutChange={onLayoutChange}
      >
        {children}
      </WorkspaceDock>
      {conversationId ? (
        <WorkspaceLayoutControls key={conversationId} conversationId={conversationId} />
      ) : null}
    </>
  )
}
