import { getRenderablePatch } from './diff-panel-content.rendering'
import type { RenderablePatch } from './diff-panel-content.types'

type DiffParseRequest = {
  id: number
  patch: string
  cacheScope: string
}

type DiffParseResponse = {
  id: number
} & (
  | { kind: 'patch'; patch: Extract<RenderablePatch, { kind: 'raw' }> | null }
  | { kind: 'files'; files: Extract<RenderablePatch, { kind: 'files' }>['files']; done: boolean }
)

const streamedFileChunkSize = 8

self.addEventListener('message', (event: MessageEvent<DiffParseRequest>) => {
  const { id, patch, cacheScope } = event.data
  const renderablePatch = getRenderablePatch(patch, cacheScope)

  if (!renderablePatch || renderablePatch.kind === 'raw') {
    self.postMessage({
      id,
      kind: 'patch',
      patch: renderablePatch,
    } satisfies DiffParseResponse)
    return
  }

  for (let index = 0; index < renderablePatch.files.length; index += streamedFileChunkSize) {
    self.postMessage({
      id,
      kind: 'files',
      files: renderablePatch.files.slice(index, index + streamedFileChunkSize),
      done: index + streamedFileChunkSize >= renderablePatch.files.length,
    } satisfies DiffParseResponse)
  }
})
