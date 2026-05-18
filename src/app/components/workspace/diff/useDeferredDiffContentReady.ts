import { useEffect, useState } from 'react'
import type { RenderablePatch } from './diff-panel-content.types'

export function useDeferredDiffContentReady(renderablePatch: RenderablePatch | null) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(false)
    if (!renderablePatch || renderablePatch.kind !== 'files') return

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
