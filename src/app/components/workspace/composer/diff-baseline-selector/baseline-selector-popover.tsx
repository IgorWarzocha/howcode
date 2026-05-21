import type { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import type { RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { ProjectCommitEntry, ProjectDiffBaseline } from '../../../../desktop/types'
import {
  composerPopoverInputClass,
  composerPopoverSectionLabelClass,
  popoverPanelClass,
} from '../../../../ui/classes'
import { cn } from '../../../../utils/cn'
import { SurfacePanel } from '../../../common/surface-panel'
import { BaselineOption, baselineOptions, CommitOption } from '../composer-diff-baseline-options'
import type { BranchSelectorPanelPosition } from './branch-selector-popover'

export function BaselineSelectorPortal({
  commitsQuery,
  panelId,
  panelPosition,
  panelRef,
  positionReady,
  searchQuery,
  selectedBaseline,
  selectedCommitSha,
  setOpen,
  setSearchQuery,
  visibleCommits,
  onSelectBaseline,
}: {
  commitsQuery: ReturnType<typeof useQuery<ProjectCommitEntry[]>>
  onSelectBaseline: (baseline: ProjectDiffBaseline) => void
  panelId: string
  panelPosition: BranchSelectorPanelPosition
  panelRef: RefObject<HTMLDivElement | null>
  positionReady: boolean
  searchQuery: string
  selectedBaseline: ProjectDiffBaseline
  selectedCommitSha: string | null
  setOpen: (open: boolean) => void
  setSearchQuery: (query: string) => void
  visibleCommits: ProjectCommitEntry[]
}) {
  if (typeof document === 'undefined') return null
  const panelLeft = `${panelPosition.left}px`
  const panelWidth = `${panelPosition.width}px`
  return createPortal(
    <SurfacePanel
      id={panelId}
      ref={panelRef}
      data-open={positionReady ? 'true' : 'false'}
      aria-label="Diff baseline selector"
      className={cn(
        popoverPanelClass,
        'motion-popover fixed z-[120] grid max-h-[calc(100vh-1rem)] grid-rows-[auto_minmax(0,1fr)_auto_auto] gap-1.5 rounded-xl border-0 p-1.5 transition-[opacity,transform] duration-150 ease-out',
        positionReady ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-1 opacity-0',
      )}
      style={{
        bottom: `${panelPosition.bottom}px`,
        left: panelLeft,
        maxHeight: `${panelPosition.maxHeight}px`,
        width: panelWidth,
      }}
    >
      <div className={composerPopoverSectionLabelClass}>Changes since</div>
      <div className="grid min-h-0 gap-0.5 overflow-y-auto pb-0.5">
        {visibleCommits.length > 0 ? (
          visibleCommits.map((commit) => (
            <CommitOption
              key={commit.sha}
              commit={commit}
              selected={selectedCommitSha === commit.sha}
              onSelect={() => {
                onSelectBaseline({ kind: 'commit', sha: commit.sha })
                setOpen(false)
              }}
            />
          ))
        ) : (
          <div className="px-2.5 py-3 text-[12px] text-[color:var(--muted)]">
            {commitsQuery.isLoading ? 'Loading commits…' : 'No commits found.'}
          </div>
        )}
      </div>
      <label className="relative block">
        <Search
          size={13}
          className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[color:var(--muted)]"
        />
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search commits"
          className={cn(composerPopoverInputClass, 'w-full pl-8')}
        />
      </label>
      {baselineOptions.map((option) => (
        <BaselineOption
          key={option.key}
          label={option.label}
          selected={selectedBaseline.kind === option.key}
          onSelect={() => {
            onSelectBaseline(option.baseline)
            setOpen(false)
          }}
        />
      ))}
    </SurfacePanel>,
    document.body,
  )
}
