const pathSeparatorPattern = /[\\/]/

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Artifact, ArtifactVersion } from '../../../desktop/types'
import {
  compileReactArtifactQuery,
  listArtifactsQuery,
  listArtifactVersionsQuery,
  updateArtifactQuery,
} from '../../../query/desktop-query'
import { getArtifactExtension } from './artifactFormat'
import { buildHtmlPreview, buildReactPreview } from './artifactPreviewBuilders'

export type ArtifactView = 'list' | 'code' | 'preview'

function getPathBaseName(filePath: string) {
  const segments = filePath.split(pathSeparatorPattern).filter(Boolean)
  return segments[segments.length - 1] ?? filePath
}

export function useArtifactPanelState(conversationId: string | null) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null)
  const [view, setView] = useState<ArtifactView>('preview')
  const [draft, setDraft] = useState('')
  const [versions, setVersions] = useState<ArtifactVersion[]>([])
  const [selectedVersion, setSelectedVersion] = useState<number | 'latest'>('latest')
  const [saving, setSaving] = useState(false)
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null)
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewRevision, setPreviewRevision] = useState(0)
  const previousSelectedArtifactSlugRef = useRef<string | null>(null)
  const draftDirtyRef = useRef(false)
  const previewSourceRef = useRef<MessageEventSource | null>(null)
  const displayedContentRef = useRef('')
  const selectedArtifactSlugRef = useRef<string | null>(null)

  const selectedArtifact = useMemo(
    () =>
      artifacts.find((artifact) => artifact.slug === selectedArtifactId) ?? artifacts[0] ?? null,
    [artifacts, selectedArtifactId],
  )
  const selectedHistoricalVersion =
    selectedVersion === 'latest'
      ? null
      : (versions.find((version) => version.version === selectedVersion) ?? null)
  const selectedArtifactSlug = selectedArtifact?.slug ?? null
  selectedArtifactSlugRef.current = selectedArtifactSlug
  const selectedArtifactVersion = selectedArtifact?.version ?? null
  const displayedContent = selectedHistoricalVersion?.content ?? selectedArtifact?.content ?? ''
  displayedContentRef.current = displayedContent
  const showingHistoricalVersion = Boolean(selectedHistoricalVersion)
  const markdownPreviewEditable =
    view === 'preview' && selectedArtifact?.kind === 'markdown' && !showingHistoricalVersion
  const draftDirty = Boolean(
    selectedArtifact && !showingHistoricalVersion && draft !== selectedArtifact.content,
  )
  draftDirtyRef.current = draftDirty
  const previewContent = showingHistoricalVersion ? displayedContent : draft
  const saveDisabled =
    !selectedArtifact ||
    saving ||
    view === 'list' ||
    (!showingHistoricalVersion && draft === selectedArtifact.content)

  useEffect(() => {
    let cancelled = false
    setArtifacts([])
    setSelectedArtifactId(null)
    setSelectedVersion('latest')
    setVersions([])
    if (!conversationId) return
    void listArtifactsQuery(conversationId).then((nextArtifacts) => {
      if (cancelled) return
      setArtifacts(nextArtifacts)
      setSelectedArtifactId((current) =>
        current && nextArtifacts.some((artifact) => artifact.slug === current)
          ? current
          : (nextArtifacts[0]?.slug ?? null),
      )
    })
    return () => {
      cancelled = true
    }
  }, [conversationId])

  useEffect(() => {
    if (!window.piDesktop?.subscribe) return
    return window.piDesktop.subscribe((event) => {
      if (event.type !== 'artifact-update') return
      if (!conversationId || event.conversationId !== conversationId) return
      setArtifacts((current) => {
        const index = current.findIndex((artifact) => artifact.slug === event.artifact.slug)
        if (index === -1) return [event.artifact, ...current]
        const next = [...current]
        next[index] = event.artifact
        return next
      })
      if (!draftDirtyRef.current) {
        setSelectedArtifactId(event.artifact.slug)
        setSelectedVersion('latest')
        setView('preview')
      }
      setPreviewRevision((revision) => revision + 1)
    })
  }, [conversationId])

  useEffect(() => {
    if (previousSelectedArtifactSlugRef.current === selectedArtifactSlug) return
    previousSelectedArtifactSlugRef.current = selectedArtifactSlug
    draftDirtyRef.current = false
    setDownloadStatus(null)
    setDraft(displayedContentRef.current)
    setSelectedVersion('latest')
  }, [selectedArtifactSlug])

  useEffect(() => {
    void selectedArtifactSlug
    void selectedVersion
    draftDirtyRef.current = false
    setDraft(displayedContentRef.current)
  }, [selectedArtifactSlug, selectedVersion])

  useEffect(() => {
    let cancelled = false
    if (!selectedArtifactSlug) {
      setVersions([])
      return
    }
    void selectedArtifactVersion
    void listArtifactVersionsQuery(selectedArtifactSlug).then((nextVersions) => {
      if (!cancelled) setVersions(nextVersions)
    })
    return () => {
      cancelled = true
    }
  }, [selectedArtifactSlug, selectedArtifactVersion])

  useEffect(() => {
    if (draftDirtyRef.current) return
    setDraft(displayedContent)
  }, [displayedContent])

  useEffect(() => {
    let cancelled = false
    setPreviewError(null)
    if (!selectedArtifact) {
      setPreviewHtml('')
      return
    }
    if (selectedArtifact.kind === 'markdown') return
    if (selectedArtifact.kind === 'html') {
      setPreviewHtml(buildHtmlPreview(previewContent))
      return
    }
    void compileReactArtifactQuery(previewContent).then((result) => {
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
  }, [selectedArtifact, previewContent])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.source !== 'howcode-artifact-preview') return
      if (previewSourceRef.current && event.source !== previewSourceRef.current) return
      setPreviewError(
        [event.data.phase, event.data.message, event.data.stack].filter(Boolean).join('\n'),
      )
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const saveDraft = async () => {
    if (!selectedArtifact) return
    const content = showingHistoricalVersion ? displayedContent : draft
    if (!showingHistoricalVersion && content === selectedArtifact.content) return
    setSaving(true)
    try {
      const updated = await updateArtifactQuery(selectedArtifact.slug, content, conversationId)
      if (updated) {
        setArtifacts((current) =>
          current.map((artifact) => (artifact.slug === updated.slug ? updated : artifact)),
        )
        setSelectedVersion('latest')
        setView('preview')
        setPreviewRevision((revision) => revision + 1)
      }
    } finally {
      setSaving(false)
    }
  }

  const downloadArtifact = async () => {
    if (!selectedArtifact) return
    const downloadArtifactSlug = selectedArtifact.slug
    const content = showingHistoricalVersion ? displayedContent : draft
    const fileName = `${selectedArtifact.slug}.${getArtifactExtension(selectedArtifact.kind)}`
    const setCurrentDownloadStatus = (message: string) => {
      if (selectedArtifactSlugRef.current === downloadArtifactSlug) {
        setDownloadStatus(message)
      }
    }
    try {
      const result = await window.piDesktop?.saveTextToDownloads?.(fileName, content)
      if (result?.ok) {
        setCurrentDownloadStatus(`Saved ${getPathBaseName(result.path ?? fileName)} to Downloads.`)
      } else {
        setCurrentDownloadStatus(result?.error ?? 'Could not save artifact to Downloads.')
      }
    } catch (error) {
      setCurrentDownloadStatus(
        error instanceof Error ? error.message : 'Could not save artifact to Downloads.',
      )
    }
  }

  return {
    artifacts,
    selectedArtifact,
    selectedVersion,
    versions,
    view,
    draft,
    displayedContent,
    showingHistoricalVersion,
    markdownPreviewEditable,
    previewHtml,
    previewError,
    previewRevision,
    saveDisabled,
    downloadStatus,
    saveDraft,
    downloadArtifact,
    setDraft,
    setPreviewError,
    setPreviewSource: (source: MessageEventSource | null) => {
      previewSourceRef.current = source
    },
    setSelectedArtifactId,
    setSelectedVersion,
    setView,
  }
}
