import { FolderCode } from 'lucide-react'
import { useEffect, useState } from 'react'
import { GitHubInvertocatMark } from '../../../../../src/app/common/github-invertocat-mark'
import type { WorkingDirectory } from '../../../../../src/app/types'
import { getDirectoryFaviconQuery } from '../../query'

const directoryFaviconCache = new Map<string, Promise<string | null>>()

function getCachedDirectoryFavicon(directoryId: string) {
  const cached = directoryFaviconCache.get(directoryId)
  if (cached) return cached

  const request = getDirectoryFaviconQuery(directoryId).catch(() => null)
  directoryFaviconCache.set(directoryId, request)
  return request
}

export function DirectoryBrandIcon({
  directory,
  size = 13,
}: {
  directory: WorkingDirectory
  size?: number
}) {
  const [favicon, setFavicon] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setFavicon(null)
    void getCachedDirectoryFavicon(directory.id).then((nextFavicon) => {
      if (!cancelled) setFavicon(nextFavicon)
    })
    return () => {
      cancelled = true
    }
  }, [directory.id])

  if (favicon) {
    return (
      <img
        src={favicon}
        alt=""
        aria-hidden="true"
        className="sidebar-project-work-project-favicon"
      />
    )
  }

  return directory.repoOriginUrl ? (
    <GitHubInvertocatMark size={size} className="sidebar-project-work-project-origin-icon" />
  ) : (
    <FolderCode size={size} />
  )
}
