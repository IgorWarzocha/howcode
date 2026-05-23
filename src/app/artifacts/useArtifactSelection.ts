import { useEffect } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { Artifact } from '../desktop/types'
import { subscribeDesktopEvents } from '../query/desktop-query'
import type { ArtifactView } from './useArtifactPanelState'

export function useArtifactSelection(input: {
  displayedContentRef: RefObject<string>
  draftDirtyRef: RefObject<boolean>
  previousSelectedArtifactSlugRef: RefObject<string | null>
  selectedArtifactSlug: string | null
  selectedVersion: number | 'latest'
  setDraft: Dispatch<SetStateAction<string>>
  setSelectedVersion: Dispatch<SetStateAction<number | 'latest'>>
}) {
  const {
    displayedContentRef,
    draftDirtyRef,
    previousSelectedArtifactSlugRef,
    selectedArtifactSlug,
    selectedVersion,
    setDraft,
    setSelectedVersion,
  } = input

  useEffect(() => {
    if (previousSelectedArtifactSlugRef.current === selectedArtifactSlug) return
    previousSelectedArtifactSlugRef.current = selectedArtifactSlug
    draftDirtyRef.current = false
    setDraft(displayedContentRef.current)
    setSelectedVersion('latest')
  }, [displayedContentRef, draftDirtyRef, previousSelectedArtifactSlugRef, selectedArtifactSlug, setDraft, setSelectedVersion])

  useEffect(() => {
    void selectedArtifactSlug
    void selectedVersion
    draftDirtyRef.current = false
    setDraft(displayedContentRef.current)
  }, [displayedContentRef, draftDirtyRef, selectedArtifactSlug, selectedVersion, setDraft])
}

export function useArtifactUpdateEvents(input: {
  conversationId: string | null
  draftDirtyRef: RefObject<boolean>
  setArtifactLoadError: Dispatch<SetStateAction<string | null>>
  setArtifacts: Dispatch<SetStateAction<Artifact[]>>
  setPreviewRevision: Dispatch<SetStateAction<number>>
  setSelectedArtifactId: Dispatch<SetStateAction<string | null>>
  setSelectedVersion: Dispatch<SetStateAction<number | 'latest'>>
  setView: Dispatch<SetStateAction<ArtifactView>>
}) {
  const {
    conversationId,
    draftDirtyRef,
    setArtifactLoadError,
    setArtifacts,
    setPreviewRevision,
    setSelectedArtifactId,
    setSelectedVersion,
    setView,
  } = input

  useEffect(() => {
    return subscribeDesktopEvents((event) => {
      if (event.type !== 'artifact-update') return
      if (!conversationId || event.conversationId !== conversationId) return
      setArtifactLoadError(null)
      setArtifacts((current) => upsertArtifact(current, event.artifact))
      if (!draftDirtyRef.current) {
        setSelectedArtifactId(event.artifact.slug)
        setSelectedVersion('latest')
        setView('preview')
      }
      setPreviewRevision((revision) => revision + 1)
    })
  }, [conversationId, draftDirtyRef, setArtifactLoadError, setArtifacts, setPreviewRevision, setSelectedArtifactId, setSelectedVersion, setView])
}

function upsertArtifact(current: Artifact[], artifact: Artifact) {
  const index = current.findIndex((candidate) => candidate.slug === artifact.slug)
  if (index === -1) return [artifact, ...current]
  const next = [...current]
  next[index] = artifact
  return next
}
