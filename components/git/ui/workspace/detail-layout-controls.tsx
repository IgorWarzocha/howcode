import { appTypeMetaClass } from '../../../../src/app/ui/classes'
import { cn } from '../../../../src/app/utils/cn'
import type { useGitDetailLayout } from './detail-layout'
import { useGitFrameInteraction } from './detail-layout-interaction'
import './detail-layout-controls.css'

const floatingEdges = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const
const edgeNames = {
  n: 'top',
  s: 'bottom',
  e: 'right',
  w: 'left',
  ne: 'top right',
  nw: 'top left',
  se: 'bottom right',
  sw: 'bottom left',
}

export function GitDetailLayoutControls(props: ReturnType<typeof useGitDetailLayout>) {
  const { layout, updateLayout, persistenceError } = props
  const floating = layout.placement === 'floating'
  const interaction = useGitFrameInteraction(props)
  const edges = floating
    ? floatingEdges
    : layout.placement === 'left'
      ? (['e'] as const)
      : layout.placement === 'right'
        ? (['w'] as const)
        : []
  return (
    <>
      <button
        type="button"
        aria-label="Git panel position"
        onClick={(event) => {
          if (event.detail === 0) updateLayout({ placement: floating ? 'main' : 'floating' })
        }}
        title="Drag to dock at either side or the top, or float elsewhere. Alt + arrows dock left, right, main (up), or float (down). Arrow keys move a floating frame; Shift for smaller steps."
        className={cn(
          'git-detail-header flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-[color:var(--border)] px-3 py-2',
          'git-detail-header-draggable',
          appTypeMetaClass,
        )}
        {...interaction.handlers('move')}
      >
        <span>Git</span>
        {persistenceError ? <p role="status">{persistenceError}</p> : null}
      </button>
      {edges.map((edge) => (
        <button
          key={edge}
          type="button"
          aria-label={`Resize Git ${edgeNames[edge]} edge`}
          title="Drag to resize; arrow keys resize; Shift for smaller steps"
          className={`git-detail-resize git-detail-resize-${edge}`}
          {...interaction.handlers(edge)}
        />
      ))}
    </>
  )
}
