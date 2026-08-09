import type { Dispatch, SetStateAction } from 'react'
import { useState } from 'react'
import type { Artifact } from '../../desktop/types'
import { updateArtifactQuery } from '../../query/desktop-query'
import type { ArtifactView } from './artifact-panel-model'

export function useArtifactSave(input: {
  conversationId: string | null
  displayedContent: string
  draft: string
  selectedArtifact: Artifact | null
  showingHistoricalVersion: boolean
  setArtifacts: Dispatch<SetStateAction<Artifact[]>>
  setPreviewRevision: Dispatch<SetStateAction<number>>
  setSelectedVersion: Dispatch<SetStateAction<number | 'latest'>>
  setView: Dispatch<SetStateAction<ArtifactView>>
}) {
  const [saving, setSaving] = useState(false)
  const saveDraft = async () => {
    if (!input.selectedArtifact) return
    const content = input.showingHistoricalVersion ? input.displayedContent : input.draft
    if (!input.showingHistoricalVersion && content === input.selectedArtifact.content) return
    setSaving(true)
    try {
      const updated = await updateArtifactQuery(
        input.selectedArtifact.slug,
        content,
        input.conversationId,
      )
      if (!updated) return
      input.setArtifacts((current) =>
        current.map((artifact) => (artifact.slug === updated.slug ? updated : artifact)),
      )
      input.setSelectedVersion('latest')
      input.setView('preview')
      input.setPreviewRevision((revision) => revision + 1)
    } finally {
      setSaving(false)
    }
  }

  return { saveDraft, saving }
}
