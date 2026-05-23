import { useEffect, useRef, useState } from 'react'
import { buildFileDiffRenderKey } from './diff-panel-content.helpers'
import { getRenderablePatch } from './diff-panel-content.rendering'
import type { RenderablePatch } from './diff-panel-content.types'

type FileRenderablePatch = Extract<RenderablePatch, { kind: 'files' }>

type DiffParseResponse = {
  id: number
} & (
  | { kind: 'patch'; patch: RenderablePatch | null }
  | { kind: 'files'; files: FileRenderablePatch['files']; done: boolean }
)

type DiffParseWorker = Worker & {
  onmessage: ((event: MessageEvent<DiffParseResponse>) => void) | null
  onmessageerror: ((event: MessageEvent) => void) | null
}

type PatchChunkState = {
  canAppend: boolean
  chunk: string
  requestId: number
}

function createDiffParseWorker(): DiffParseWorker {
  return new Worker(new URL('./diff-parse-worker.ts', import.meta.url), {
    type: 'module',
  }) as DiffParseWorker
}

function getPatchChunkState({
  previousPatch,
  requestId,
  selectedPatch,
}: {
  previousPatch: string | undefined
  requestId: number
  selectedPatch: string
}): PatchChunkState {
  const canAppend = typeof previousPatch === 'string' && selectedPatch.startsWith(previousPatch)
  return {
    canAppend,
    chunk: canAppend ? selectedPatch.slice(previousPatch.length) : selectedPatch,
    requestId: canAppend ? requestId : requestId + 1,
  }
}

function appendFiles(
  current: RenderablePatch | null,
  files: FileRenderablePatch['files'],
): RenderablePatch {
  if (!current || current.kind !== 'files') return { kind: 'files', files }
  const nextFiles = [...current.files]
  const indexByKey = new Map(
    nextFiles.map((fileDiff, index) => [buildFileDiffRenderKey(fileDiff), index] as const),
  )
  for (const fileDiff of files) {
    const key = buildFileDiffRenderKey(fileDiff)
    const existingIndex = indexByKey.get(key)
    if (existingIndex === undefined) {
      indexByKey.set(key, nextFiles.length)
      nextFiles.push(fileDiff)
    } else {
      nextFiles[existingIndex] = fileDiff
    }
  }
  return { kind: 'files', files: nextFiles }
}

export function useWorkerRenderablePatch(selectedPatch: string | undefined, done = true) {
  const [renderablePatch, setRenderablePatch] = useState<RenderablePatch | null>(null)
  const requestIdRef = useRef(0)
  const previousPatchRef = useRef<string | undefined>(undefined)
  const workerRef = useRef<DiffParseWorker | null>(null)

  useEffect(() => {
    if (typeof selectedPatch !== 'string') {
      requestIdRef.current += 1
      previousPatchRef.current = undefined
      setRenderablePatch(null)
      return
    }

    const chunkState = getPatchChunkState({
      previousPatch: previousPatchRef.current,
      requestId: requestIdRef.current,
      selectedPatch,
    })
    previousPatchRef.current = selectedPatch
    requestIdRef.current = chunkState.requestId
    if (!chunkState.canAppend) setRenderablePatch(null)
    if (chunkState.chunk.length === 0 && !done) return

    let active = true
    let worker: DiffParseWorker
    const parseOnMainThread = () => {
      if (!active || chunkState.requestId !== requestIdRef.current) return
      setRenderablePatch(getRenderablePatch(selectedPatch, 'diff-panel:dark'))
    }
    const fallbackFromFailedWorker = () => {
      if (!active) return
      if (workerRef.current === worker) {
        worker.terminate()
        workerRef.current = null
      }
      parseOnMainThread()
    }

    try {
      worker = workerRef.current ?? createDiffParseWorker()
    } catch {
      workerRef.current = null
      parseOnMainThread()
      return
    }

    workerRef.current = worker
    worker.onmessage = (event) => {
      if (!active || event.data.id !== requestIdRef.current) return
      if (event.data.kind === 'patch') {
        setRenderablePatch(event.data.patch)
        return
      }
      setRenderablePatch((current) => appendFiles(current, event.data.files))
    }
    worker.onerror = fallbackFromFailedWorker
    worker.onmessageerror = fallbackFromFailedWorker

    try {
      worker.postMessage({
        id: chunkState.requestId,
        kind: chunkState.canAppend ? 'append' : 'reset',
        chunk: chunkState.chunk,
        done,
        cacheScope: 'diff-panel:dark',
        patch: selectedPatch,
      })
    } catch {
      fallbackFromFailedWorker()
    }

    return () => {
      active = false
      if (workerRef.current === worker) {
        worker.onmessage = null
        worker.onerror = null
        worker.onmessageerror = null
      }
    }
  }, [done, selectedPatch])

  useEffect(
    () => () => {
      workerRef.current?.terminate()
      workerRef.current = null
    },
    [],
  )

  return renderablePatch
}
