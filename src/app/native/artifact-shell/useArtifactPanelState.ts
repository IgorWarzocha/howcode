import { useArtifactPreview } from '@howcode/native-interactive-artifacts'
import { useRef, useState } from 'react'
import type { Artifact, ArtifactVersion } from '../../desktop/types'
import { useLatestRef } from '../../hooks/useLatestRef'
import { useArtifactCollection } from './useArtifactCollection'
import { useArtifactDerivedState } from './useArtifactDerivedState'
import { useArtifactDownload } from './useArtifactDownload'
import { useArtifactDraft } from './useArtifactDraft'
import { useArtifactSave } from './useArtifactSave'
import { useArtifactSelection, useArtifactUpdateEvents } from './useArtifactSelection'
import { useArtifactVersions } from './useArtifactVersions'

export type ArtifactView = 'list' | 'code' | 'preview'

export function useArtifactPanelState(conversationId: string | null) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null)
  const [view, setView] = useState<ArtifactView>('preview')
  const [draft, setDraft] = useState('')
  const [versions, setVersions] = useState<ArtifactVersion[]>([])
  const [selectedVersion, setSelectedVersion] = useState<number | 'latest'>('latest')
  const [previewRevision, setPreviewRevision] = useState(0)
  const previousSelectedArtifactSlugRef = useRef<string | null>(null)

  const derivedState = useArtifactDerivedState({
    artifacts,
    draft,
    selectedArtifactId,
    selectedVersion,
    versions,
    view,
  })
  const {
    displayedContent,
    draftDirty,
    markdownPreviewEditable,
    previewContent,
    selectedArtifact,
    selectedArtifactSlug,
    selectedArtifactVersion,
    showingHistoricalVersion,
  } = derivedState
  const displayedContentRef = useLatestRef(displayedContent)
  const draftDirtyRef = useLatestRef(draftDirty)
  const { artifactLoadError, loadingArtifacts, setArtifactLoadError } = useArtifactCollection({
    conversationId,
    setArtifacts,
    setSelectedArtifactId,
    setSelectedVersion,
    setVersions,
  })

  useArtifactUpdateEvents({
    conversationId,
    draftDirtyRef,
    setArtifactLoadError,
    setArtifacts,
    setPreviewRevision,
    setSelectedArtifactId,
    setSelectedVersion,
    setView,
  })
  useArtifactSelection({
    displayedContentRef,
    draftDirtyRef,
    previousSelectedArtifactSlugRef,
    selectedArtifactSlug,
    selectedVersion,
    setDraft,
    setSelectedVersion,
  })

  useArtifactVersions({ selectedArtifactSlug, selectedArtifactVersion, setVersions })
  useArtifactDraft({ displayedContent, draftDirtyRef, setDraft })
  const { previewError, previewHtml, setPreviewError, setPreviewSource } = useArtifactPreview({
    previewContent,
    selectedArtifact,
  })

  const { saveDraft, saving } = useArtifactSave({
    conversationId,
    displayedContent,
    draft,
    selectedArtifact,
    showingHistoricalVersion,
    setArtifacts,
    setPreviewRevision,
    setSelectedVersion,
    setView,
  })
  const saveDisabled =
    !selectedArtifact ||
    saving ||
    view === 'list' ||
    (!showingHistoricalVersion && draft === selectedArtifact.content)

  const { downloadArtifact, downloadStatus } = useArtifactDownload({
    displayedContent,
    draft,
    selectedArtifact,
    selectedArtifactSlug,
    showingHistoricalVersion,
  })

  return {
    artifacts,
    artifactLoadError,
    loadingArtifacts,
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
    setPreviewSource,
    setSelectedArtifactId,
    setSelectedVersion,
    setView,
  }
}
