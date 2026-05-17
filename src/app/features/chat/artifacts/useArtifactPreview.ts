import { useEffect, useRef, useState } from 'react'
import type { Artifact } from '../../../desktop/types'
import { compileReactArtifactQuery } from '../../../query/desktop-query'
import { buildHtmlPreview, buildReactPreview } from './artifactPreviewBuilders'

export function useArtifactPreview(input: {
  previewContent: string
  selectedArtifact: Artifact | null
}) {
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewError, setPreviewError] = useState<string | null>(null)
  const previewSourceRef = useRef<MessageEventSource | null>(null)

  useEffect(() => {
    let cancelled = false
    setPreviewError(null)
    if (!input.selectedArtifact) {
      setPreviewHtml('')
      return
    }
    if (input.selectedArtifact.kind === 'markdown') return
    if (input.selectedArtifact.kind === 'html') {
      setPreviewHtml(buildHtmlPreview(input.previewContent))
      return
    }
    void compileReactArtifactQuery(input.previewContent).then((result) => {
      if (cancelled) return
      if (result.ok) {
        setPreviewHtml(buildReactPreview(result.js))
        setPreviewError(result.warnings.join('\n') || null)
      } else {
        setPreviewHtml('')
        setPreviewError(result.error)
      }
    })
    return () => {
      cancelled = true
    }
  }, [input.previewContent, input.selectedArtifact])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.source !== 'howcode-artifact-preview') return
      if (previewSourceRef.current && event.source !== previewSourceRef.current) return
      setPreviewError([event.data.phase, event.data.message, event.data.stack].filter(Boolean).join('\n'))
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  return {
    previewError,
    previewHtml,
    setPreviewError,
    setPreviewSource: (source: MessageEventSource | null) => {
      previewSourceRef.current = source
    },
  }
}
