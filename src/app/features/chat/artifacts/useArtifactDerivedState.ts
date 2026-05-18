import { useMemo } from 'react'
import type { Artifact, ArtifactVersion } from '../../../desktop/types'
import type { ArtifactView } from './useArtifactPanelState'

export function useArtifactDerivedState(input: {
  artifacts: Artifact[]
  draft: string
  selectedArtifactId: string | null
  selectedVersion: number | 'latest'
  versions: ArtifactVersion[]
  view: ArtifactView
}) {
  const selectedArtifact = useMemo(
    () =>
      input.artifacts.find((artifact) => artifact.slug === input.selectedArtifactId) ??
      input.artifacts[0] ??
      null,
    [input.artifacts, input.selectedArtifactId],
  )
  const selectedHistoricalVersion =
    input.selectedVersion === 'latest'
      ? null
      : (input.versions.find((version) => version.version === input.selectedVersion) ?? null)
  const displayedContent = selectedHistoricalVersion?.content ?? selectedArtifact?.content ?? ''
  const showingHistoricalVersion = Boolean(selectedHistoricalVersion)

  return {
    displayedContent,
    draftDirty: Boolean(
      selectedArtifact && !showingHistoricalVersion && input.draft !== selectedArtifact.content,
    ),
    markdownPreviewEditable:
      input.view === 'preview' && selectedArtifact?.kind === 'markdown' && !showingHistoricalVersion,
    previewContent: showingHistoricalVersion ? displayedContent : input.draft,
    selectedArtifact,
    selectedArtifactSlug: selectedArtifact?.slug ?? null,
    selectedArtifactVersion: selectedArtifact?.version ?? null,
    showingHistoricalVersion,
  }
}
