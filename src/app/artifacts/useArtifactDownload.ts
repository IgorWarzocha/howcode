import { useEffect, useRef, useState } from 'react'
import type { Artifact } from '../desktop/types'
import { saveTextToDownloadsQuery } from '../query/desktop-query'
import { getArtifactExtension } from './artifactFormat'

const pathSeparatorPattern = /[\\/]/

function getPathBaseName(filePath: string) {
  const segments = filePath.split(pathSeparatorPattern).filter(Boolean)
  return segments[segments.length - 1] ?? filePath
}

export function useArtifactDownload(input: {
  displayedContent: string
  draft: string
  selectedArtifact: Artifact | null
  selectedArtifactSlug: string | null
  showingHistoricalVersion: boolean
}) {
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null)
  const selectedArtifactSlugRef = useRef<string | null>(null)
  selectedArtifactSlugRef.current = input.selectedArtifactSlug

  useEffect(() => {
    setDownloadStatus(null)
  }, [input.selectedArtifactSlug])

  const downloadArtifact = async () => {
    if (!input.selectedArtifact) return
    const downloadArtifactSlug = input.selectedArtifact.slug
    const content = input.showingHistoricalVersion ? input.displayedContent : input.draft
    const fileName = `${input.selectedArtifact.slug}.${getArtifactExtension(input.selectedArtifact.kind)}`
    const setCurrentDownloadStatus = (message: string) => {
      if (selectedArtifactSlugRef.current === downloadArtifactSlug) setDownloadStatus(message)
    }
    try {
      const result = await saveTextToDownloadsQuery(fileName, content)
      if (result?.ok) {
        setCurrentDownloadStatus(`Saved ${getPathBaseName(result.path ?? fileName)} to Downloads.`)
      } else {
        setCurrentDownloadStatus(result?.error ?? 'Could not save artifact to Downloads.')
      }
    } catch (error) {
      setCurrentDownloadStatus(error instanceof Error ? error.message : 'Could not save artifact to Downloads.')
    }
  }

  return { downloadArtifact, downloadStatus }
}
