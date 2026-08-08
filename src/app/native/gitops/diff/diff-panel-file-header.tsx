import type { FileDiffMetadata } from '@pierre/diffs/react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import {
  appToneMutedClass,
  appToneTextClass,
  appTypeGroupTitleClass,
  appTypeSmallClass,
  diffFileHeaderButtonClass,
} from '../../../ui/classes'
import { cn } from '../../../utils/cn'
import { getFileChangeCounts, getFileHeaderContextLabel } from './diff-panel-content.helpers'

export function DiffPanelFileHeader({
  fileDiff,
  fileKey,
  filePath,
  isCollapsed,
  onToggleFileCollapsed,
}: {
  fileDiff: FileDiffMetadata
  fileKey: string
  filePath: string
  isCollapsed: boolean
  onToggleFileCollapsed: (fileKey: string) => void
}) {
  const headerContextLabel = getFileHeaderContextLabel(fileDiff)
  const { additions, deletions } = getFileChangeCounts(fileDiff)
  return (
    <button
      type="button"
      className={diffFileHeaderButtonClass}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onToggleFileCollapsed(fileKey)
      }}
      aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${filePath}`}
      aria-expanded={!isCollapsed}
      data-diff-file-path={filePath}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-[color:var(--muted)]">
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </span>
        <span className={cn('truncate', appTypeGroupTitleClass, appToneTextClass)}>{filePath}</span>
        {headerContextLabel ? (
          <span className={cn('shrink-0', appTypeSmallClass, appToneMutedClass)}>
            {headerContextLabel}
          </span>
        ) : null}
      </span>
      <span className={cn('flex shrink-0 items-center gap-2', appTypeSmallClass)}>
        {deletions > 0 || additions === 0 ? (
          <span className="text-[color:var(--danger)]">-{deletions}</span>
        ) : null}
        {additions > 0 || deletions === 0 ? (
          <span className="text-[color:var(--green)]">+{additions}</span>
        ) : null}
      </span>
    </button>
  )
}
