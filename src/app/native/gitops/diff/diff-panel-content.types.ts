import type { FileDiffMetadata } from '@pierre/diffs/react'

export type RenderablePatch =
  | {
      kind: 'files'
      files: FileDiffMetadata[]
    }
  | {
      kind: 'raw'
      text: string
      reason: string
    }
