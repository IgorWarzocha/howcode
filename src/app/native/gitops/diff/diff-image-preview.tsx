const gitDiffPrefixPattern = /^[ab]\//

import type { FileDiffMetadata } from '@pierre/diffs/react'
import { useQuery } from '@tanstack/react-query'
import type { ProjectDiffBaseline, ProjectDiffImageSide } from '../../../desktop/types'
import { getProjectDiffImagePreviewQuery } from '../../../query/desktop-query'
import { desktopQueryKeys } from '../../../query/desktop-query-keys'
import {
  appToneMutedClass,
  appTypeMetaStrongClass,
  appTypeSmallClass,
  diffImagePreviewClass,
  diffImagePreviewFrameClass,
  diffImagePreviewPanelClass,
} from '../../../ui/classes'
import { cn } from '../../../utils/cn'

function getImageSidePath(fileDiff: FileDiffMetadata, side: ProjectDiffImageSide) {
  const path = side === 'old' ? (fileDiff.prevName ?? fileDiff.name) : fileDiff.name
  return path?.replace(gitDiffPrefixPattern, '') ?? ''
}

function DiffImagePreviewPane({
  baseline,
  filePath,
  projectId,
  side,
}: {
  baseline: ProjectDiffBaseline | null
  filePath: string
  projectId: string
  side: ProjectDiffImageSide
}) {
  const previewQuery = useQuery({
    queryKey: desktopQueryKeys.projectDiffImagePreview(projectId, filePath, side, baseline),
    queryFn: () => getProjectDiffImagePreviewQuery({ projectId, baseline, path: filePath, side }),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  })
  const label = side === 'old' ? 'Before' : 'After'

  return (
    <div className={diffImagePreviewPanelClass}>
      <div className={cn(appTypeMetaStrongClass, appToneMutedClass)}>{label}</div>
      <div className={diffImagePreviewFrameClass}>
        {previewQuery.data?.dataUrl ? (
          <img
            src={previewQuery.data.dataUrl}
            alt={`${label} preview for ${filePath}`}
            className="max-h-[58vh] max-w-full object-contain"
          />
        ) : (
          <div className={cn(appTypeSmallClass, appToneMutedClass)}>
            {previewQuery.isLoading ? 'Loading image…' : 'No image preview'}
          </div>
        )}
      </div>
    </div>
  )
}

export function DiffImagePreview({
  baseline,
  fileDiff,
  projectId,
}: {
  baseline: ProjectDiffBaseline | null
  fileDiff: FileDiffMetadata
  projectId: string
}) {
  const sides: ProjectDiffImageSide[] =
    fileDiff.type === 'new' ? ['new'] : fileDiff.type === 'deleted' ? ['old'] : ['old', 'new']

  return (
    <div className={cn(diffImagePreviewClass, sides.length === 1 && 'md:grid-cols-1')}>
      {sides.map((side) => (
        <DiffImagePreviewPane
          key={side}
          baseline={baseline}
          filePath={getImageSidePath(fileDiff, side)}
          projectId={projectId}
          side={side}
        />
      ))}
    </div>
  )
}
