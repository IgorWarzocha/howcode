const gitDiffPrefixPattern = /^[ab]\//

import type { FileDiffMetadata } from '@pierre/diffs/react'
import { useQuery } from '@tanstack/react-query'
import type {
  DirectoryDiffBaseline,
  DirectoryDiffImageSide,
} from '../../../../../src/app/desktop/types'
import { desktopQueryKeys } from '../../../../../src/app/query/desktop-query-keys'
import {
  appToneMutedClass,
  appTypeMetaStrongClass,
  appTypeSmallClass,
  diffImagePreviewClass,
  diffImagePreviewFrameClass,
  diffImagePreviewPanelClass,
} from '../../../../../src/app/ui/classes'
import { cn } from '../../../../../src/app/utils/cn'
import { getDirectoryDiffImagePreviewQuery } from '../../query'

function getImageSidePath(fileDiff: FileDiffMetadata, side: DirectoryDiffImageSide) {
  const path = side === 'old' ? (fileDiff.prevName ?? fileDiff.name) : fileDiff.name
  return path?.replace(gitDiffPrefixPattern, '') ?? ''
}

function DiffImagePreviewPane({
  baseline,
  filePath,
  directoryId,
  side,
}: {
  baseline: DirectoryDiffBaseline | null
  filePath: string
  directoryId: string
  side: DirectoryDiffImageSide
}) {
  const previewQuery = useQuery({
    queryKey: desktopQueryKeys.directoryDiffImagePreview(directoryId, filePath, side, baseline),
    queryFn: () =>
      getDirectoryDiffImagePreviewQuery({ directoryId, baseline, path: filePath, side }),
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
  directoryId,
}: {
  baseline: DirectoryDiffBaseline | null
  fileDiff: FileDiffMetadata
  directoryId: string
}) {
  const sides: DirectoryDiffImageSide[] =
    fileDiff.type === 'new' ? ['new'] : fileDiff.type === 'deleted' ? ['old'] : ['old', 'new']

  return (
    <div className={cn(diffImagePreviewClass, sides.length === 1 && 'md:grid-cols-1')}>
      {sides.map((side) => (
        <DiffImagePreviewPane
          key={side}
          baseline={baseline}
          filePath={getImageSidePath(fileDiff, side)}
          directoryId={directoryId}
          side={side}
        />
      ))}
    </div>
  )
}
