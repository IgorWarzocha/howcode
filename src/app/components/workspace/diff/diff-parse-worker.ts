import { getRenderablePatch } from './diff-panel-content.rendering'
import type { RenderablePatch } from './diff-panel-content.types'

type DiffParseRequest = {
  id: number
  patch: string
  cacheScope: string
}

type DiffParseResponse = {
  id: number
  patch: RenderablePatch | null
}

self.addEventListener('message', (event: MessageEvent<DiffParseRequest>) => {
  const { id, patch, cacheScope } = event.data
  const response: DiffParseResponse = {
    id,
    patch: getRenderablePatch(patch, cacheScope),
  }
  self.postMessage(response)
})
