import { useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { ArtifactVersion } from '../../../desktop/types'
import { listArtifactVersionsQuery } from '../../../query/desktop-query'

export function useArtifactVersions(input: {
  selectedArtifactSlug: string | null
  selectedArtifactVersion: number | null
  setVersions: Dispatch<SetStateAction<ArtifactVersion[]>>
}) {
  const { selectedArtifactSlug, selectedArtifactVersion, setVersions } = input
  useEffect(() => {
    let cancelled = false
    if (!selectedArtifactSlug) {
      setVersions([])
      return
    }
    void selectedArtifactVersion
    void listArtifactVersionsQuery(selectedArtifactSlug)
      .then((nextVersions) => {
        if (!cancelled) setVersions(nextVersions)
      })
      .catch(() => {
        if (!cancelled) setVersions([])
      })
    return () => {
      cancelled = true
    }
  }, [selectedArtifactSlug, selectedArtifactVersion, setVersions])
}
