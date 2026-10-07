import type { FileDiffMetadata } from '@pierre/diffs'
import { buildFileDiffRenderKey, resolveFileDiffPath } from './diff-panel-content.helpers'

export function getDiffFileIdentity(fileDiff: FileDiffMetadata) {
  return { fileKey: buildFileDiffRenderKey(fileDiff), filePath: resolveFileDiffPath(fileDiff) }
}
