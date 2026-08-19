import type { FileDiffMetadata } from '@pierre/diffs/react'
import { Check, LoaderCircle, Pencil } from 'lucide-react'
import { Tooltip } from '../../../common/tooltip'
import { compactIconButtonClass } from '../../../ui/classes'
import { cn } from '../../../utils/cn'
import { isImageDiffFile } from '../diff/diff-panel-content.helpers'
import { getDiffEditButtonPresentation } from './diff-editing-model'
import type { DiffEditingController } from './use-diff-editing'

export function DiffFileEditButton({
  editing,
  fileDiff,
  fileKey,
  onBeforeStart,
}: {
  editing: DiffEditingController
  fileDiff: FileDiffMetadata
  fileKey: string
  onBeforeStart: () => void
}) {
  const presentation = getDiffEditButtonPresentation(editing.state, fileKey)
  const isEligible = fileDiff.type !== 'deleted' && !isImageDiffFile(fileDiff)

  return (
    <Tooltip content={isEligible ? presentation.label : 'This file cannot be edited'}>
      <button
        type="button"
        className={cn(compactIconButtonClass, 'shrink-0')}
        disabled={
          !isEligible ||
          presentation.busyElsewhere ||
          presentation.icon === 'loading' ||
          presentation.saving
        }
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          if (presentation.active) {
            void editing.save(fileKey)
          } else {
            onBeforeStart()
            void editing.start({ fileDiff, fileKey })
          }
        }}
        aria-label={presentation.label}
      >
        {presentation.icon === 'loading' ? (
          <LoaderCircle size={13} className="animate-spin" />
        ) : presentation.icon === 'save' ? (
          <Check size={13} />
        ) : (
          <Pencil size={13} />
        )}
      </button>
    </Tooltip>
  )
}
