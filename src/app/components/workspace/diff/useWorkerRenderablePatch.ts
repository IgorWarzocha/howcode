import { useEffect, useRef, useState } from 'react'
import type { RenderablePatch } from './diff-panel-content.types'

type DiffParseResponse = {
  id: number
  patch: RenderablePatch | null
}

type DiffParseWorker = Worker & {
  onmessage: ((event: MessageEvent<DiffParseResponse>) => void) | null
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

    const worker = workerRef.current ?? createDiffParseWorker()
    workerRef.current = worker
    worker.onmessage = (event) => {
      if (event.data.id !== requestIdRef.current) return
      setRenderablePatch(event.data.patch)
    }
    worker.postMessage({ id: requestId, patch: selectedPatch, cacheScope: 'diff-panel:dark' })
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
