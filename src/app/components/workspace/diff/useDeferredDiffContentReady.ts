import { useEffect, useRef, useState } from 'react'
import type { RenderablePatch } from './diff-panel-content.types'

export function useDeferredDiffContentReady(renderablePatch: RenderablePatch | null) {
  const [ready, setReady] = useState(false)
  const hadFilesRef = useRef(false)

  useEffect(() => {
    const hasFiles = renderablePatch?.kind === 'files'
    if (!hasFiles) {
      hadFilesRef.current = false
      setReady(false)
      return
    }

    const keepExistingFileContentVisible = hadFilesRef.current
    hadFilesRef.current = true
    if (keepExistingFileContentVisible) return

    setReady(false)
    let cancelled = false
    const firstFrame = window.requestAnimationFrame(() => {
      const secondFrame = window.requestAnimationFrame(() => {
        if (!cancelled) setReady(true)
      })
      if (cancelled) window.cancelAnimationFrame(secondFrame)
    })

    return () => {
      cancelled = true
      window.cancelAnimationFrame(firstFrame)
    }
  }, [renderablePatch])

  return ready
}
