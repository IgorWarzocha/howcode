import { useEffect, useRef, useState } from 'react'
import { getRenderablePatch } from './diff-panel-content.rendering'
import type { RenderablePatch } from './diff-panel-content.types'

type DiffParseResponse = {
  id: number
} & (
  | { kind: 'patch'; patch: RenderablePatch | null }
  | { kind: 'files'; files: Extract<RenderablePatch, { kind: 'files' }>['files']; done: boolean }
)

type DiffParseWorker = Worker & {
  onmessage: ((event: MessageEvent<DiffParseResponse>) => void) | null
  onmessageerror: ((event: MessageEvent) => void) | null
}

function createDiffParseWorker(): DiffParseWorker {
  return new Worker(new URL('./diff-parse-worker.ts', import.meta.url), {
    type: 'module',
  }) as DiffParseWorker
}

export function useWorkerRenderablePatch(selectedPatch: string | undefined) {
  const [renderablePatch, setRenderablePatch] = useState<RenderablePatch | null>(null)
  const requestIdRef = useRef(0)
  const workerRef = useRef<DiffParseWorker | null>(null)

  useEffect(() => {
    if (typeof selectedPatch !== 'string') {
      requestIdRef.current += 1
      setRenderablePatch(null)
      return
    }

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setRenderablePatch(null)

    let active = true
    const parseOnMainThread = () => {
      if (!active || requestId !== requestIdRef.current) return
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

    let worker: DiffParseWorker
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

      setRenderablePatch((current) => {
        if (!current || current.kind !== 'files') {
          return { kind: 'files', files: event.data.files }
        }

        return { kind: 'files', files: [...current.files, ...event.data.files] }
      })
    }
    worker.onerror = fallbackFromFailedWorker
    worker.onmessageerror = fallbackFromFailedWorker

    try {
      worker.postMessage({ id: requestId, patch: selectedPatch, cacheScope: 'diff-panel:dark' })
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
  }, [selectedPatch])

  useEffect(
    () => () => {
      workerRef.current?.terminate()
      workerRef.current = null
    },
    [],
  )

  return renderablePatch
}
