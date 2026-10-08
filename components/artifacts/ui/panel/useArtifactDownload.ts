import { useLatestRef } from '@howaboua/howcode-sdk/hooks/useLatestRef'
import { useEffect, useState } from 'react'
import type { Artifact } from '../../../../src/app/desktop/types'

import { saveTextToDownloadsQuery } from '../query'
import { getArtifactExtension } from './artifactFormat'

export function useArtifactDownload(input: {
  displayedContent: string
  draft: string
  selectedArtifact: Artifact | null
  selectedArtifactSlug: string | null
  showingHistoricalVersion: boolean
}) {
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null)
  const { selectedArtifactSlug } = input
  const selectedArtifactSlugRef = useLatestRef(selectedArtifactSlug)

  useEffect(() => {
    void selectedArtifactSlug
    setDownloadStatus(null)
  }, [selectedArtifactSlug])

  const downloadArtifact = async () => {
    if (!input.selectedArtifact) return
    const downloadArtifactSlug = input.selectedArtifact.slug
    const content = input.showingHistoricalVersion ? input.displayedContent : input.draft
    const fileName = `${input.selectedArtifact.slug}.${getArtifactExtension(input.selectedArtifact.kind)}`
    const setCurrentDownloadStatus = (message: string) => {
      if (selectedArtifactSlugRef.current === downloadArtifactSlug) setDownloadStatus(message)
    }
    try {
      await saveTextToDownloadsQuery(fileName, content)
      setCurrentDownloadStatus(`Download requested for ${fileName}.`)
    } catch (error) {
      setCurrentDownloadStatus(
        error instanceof Error ? error.message : 'Could not download artifact.',
      )
    }
  }

  return { downloadArtifact, downloadStatus }
}
