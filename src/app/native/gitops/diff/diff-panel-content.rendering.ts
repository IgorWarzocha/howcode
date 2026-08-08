const imageDiffFilePattern = /\.(?:apng|avif|bmp|gif|jpe?g|png|svg|webp)$/i

import { parsePatchFiles } from '@pierre/diffs'
import type { FileDiffMetadata } from '@pierre/diffs/react'
import type { RenderablePatch } from './diff-panel-content.types'
import { buildPatchCacheKey } from './diff-rendering'

export function getRenderablePatch(
  patch: string | undefined,
  cacheScope = 'diff-panel',
): RenderablePatch | null {
  if (!patch) return null
  const normalizedPatch = patch.trim()
  if (normalizedPatch.length === 0) return null

  try {
    const parsedPatches = parsePatchFiles(
      normalizedPatch,
      buildPatchCacheKey(normalizedPatch, cacheScope),
    )
    const files = parsedPatches.flatMap((parsedPatch) => parsedPatch.files)
    if (files.length > 0) {
      return { kind: 'files', files: orderRenderableFiles(files) }
    }

    return {
      kind: 'raw',
      text: normalizedPatch,
      reason: 'Unsupported diff format. Showing raw patch.',
    }
  } catch {
    return {
      kind: 'raw',
      text: normalizedPatch,
      reason: 'Failed to parse patch. Showing raw patch.',
    }
  }
}

export function resolveDiffFilePath(raw: string) {
  if (raw.startsWith('a/') || raw.startsWith('b/')) {
    return raw.slice(2)
  }

  return raw
}

export function resolveFileDiffPath(fileDiff: FileDiffMetadata): string {
  return resolveDiffFilePath(fileDiff.name ?? fileDiff.prevName ?? '')
}

export function buildFileDiffRenderKey(fileDiff: FileDiffMetadata): string {
  return JSON.stringify([fileDiff.prevName ?? null, fileDiff.name])
}

export function describeCollapsedLines(count: number) {
  return `${count} unmodified line${count === 1 ? '' : 's'}`
}

export function getFileHeaderContextLabel(fileDiff: FileDiffMetadata) {
  const collapsedBefore = fileDiff.hunks[0]?.collapsedBefore ?? 0
  return collapsedBefore > 0 ? describeCollapsedLines(collapsedBefore) : null
}

export function getFileChangeCounts(fileDiff: FileDiffMetadata) {
  let additions = 0
  let deletions = 0

  for (const hunk of fileDiff.hunks) {
    additions += hunk.additionLines
    deletions += hunk.deletionLines
  }

  return { additions, deletions }
}

export function isImageDiffFile(fileDiff: FileDiffMetadata) {
  return imageDiffFilePattern.test(resolveFileDiffPath(fileDiff))
}

export function orderRenderableFiles(fileDiffs: readonly FileDiffMetadata[]) {
  return fileDiffs.toSorted((left, right) =>
    resolveFileDiffPath(left).localeCompare(resolveFileDiffPath(right), undefined, {
      numeric: true,
      sensitivity: 'base',
    }),
  )
}
