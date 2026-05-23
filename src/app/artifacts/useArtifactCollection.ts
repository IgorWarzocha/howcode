import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Artifact, ArtifactVersion } from '../desktop/types'
import { listArtifactsQuery } from '../query/desktop-query'

export function useArtifactCollection(input: {
  conversationId: string | null
  setArtifacts: Dispatch<SetStateAction<Artifact[]>>
  setSelectedArtifactId: Dispatch<SetStateAction<string | null>>
  setSelectedVersion: Dispatch<SetStateAction<number | 'latest'>>
  setVersions: Dispatch<SetStateAction<ArtifactVersion[]>>
}) {
  const [loadingArtifacts, setLoadingArtifacts] = useState(false)
  const [artifactLoadError, setArtifactLoadError] = useState<string | null>(null)
  const { conversationId, setArtifacts, setSelectedArtifactId, setSelectedVersion, setVersions } = input

  useEffect(() => {
    let cancelled = false
    setArtifacts([])
    setSelectedArtifactId(null)
    setSelectedVersion('latest')
    setVersions([])
    setArtifactLoadError(null)
    if (!conversationId) {
      setLoadingArtifacts(false)
      return
    }
    setLoadingArtifacts(true)
    void listArtifactsQuery(conversationId)
      .then((nextArtifacts) => {
        if (cancelled) return
        setArtifacts(nextArtifacts)
        setArtifactLoadError(null)
        setSelectedArtifactId((current) =>
          current && nextArtifacts.some((artifact) => artifact.slug === current)
            ? current
            : (nextArtifacts[0]?.slug ?? null),
        )
      })
      .catch((error) => {
        if (!cancelled) {
          setArtifactLoadError(error instanceof Error ? error.message : 'Could not load artifacts.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingArtifacts(false)
      })
    return () => {
      cancelled = true
    }
  }, [conversationId, setArtifacts, setSelectedArtifactId, setSelectedVersion, setVersions])

  return { artifactLoadError, loadingArtifacts, setArtifactLoadError }
}
