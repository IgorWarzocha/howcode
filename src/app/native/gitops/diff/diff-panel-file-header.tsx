import type { FileDiffMetadata } from '@pierre/diffs/react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import {
  appToneMutedClass,
  appToneTextClass,
  appTypeGroupTitleClass,
  appTypeSmallClass,
  diffFileHeaderButtonClass,
  diffFileHeaderClass,
} from '../../../ui/classes'
import { cn } from '../../../utils/cn'
import { DiffFileEditButton } from '../edit/diff-file-edit-button'
import type { DiffEditingController } from '../edit/use-diff-editing'
import { getFileChangeCounts, getFileHeaderContextLabel } from './diff-panel-content.helpers'

export function DiffPanelFileHeader({
  fileDiff,
  editing,
  fileKey,
  filePath,
  isCollapsed,
  onToggleFileCollapsed,
}: {
  fileDiff: FileDiffMetadata
  editing: DiffEditingController
  fileKey: string
  filePath: string
  isCollapsed: boolean
  onToggleFileCollapsed: (fileKey: string) => void
}) {
  const headerContextLabel = getFileHeaderContextLabel(fileDiff)
  const { additions, deletions } = getFileChangeCounts(fileDiff)
  const editOwnsFile = editing.state.kind !== 'idle' && editing.state.fileKey === fileKey
  return (
    <div className={diffFileHeaderClass} data-diff-file-path={filePath}>
      <button
        type="button"
        className={diffFileHeaderButtonClass}
        disabled={editOwnsFile}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onToggleFileCollapsed(fileKey)
        }}
        aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${filePath}`}
        aria-expanded={!isCollapsed}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-[color:var(--muted)]">
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </span>
          <span className={cn('truncate', appTypeGroupTitleClass, appToneTextClass)}>
            {filePath}
          </span>
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
      <DiffFileEditButton
        editing={editing}
        fileDiff={fileDiff}
        fileKey={fileKey}
        onBeforeStart={() => {
          if (isCollapsed) onToggleFileCollapsed(fileKey)
        }}
      />
    </div>
  )
}
