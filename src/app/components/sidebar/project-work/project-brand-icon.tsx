import { GitHubInvertocatMark } from '@howcode/common/github-invertocat-mark'
import { FolderCode } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getProjectFaviconQuery } from '../../../query/desktop-query'
import type { Project } from '../../../types'

const projectFaviconCache = new Map<string, Promise<string | null>>()

function getCachedProjectFavicon(projectId: string) {
  const cached = projectFaviconCache.get(projectId)
  if (cached) return cached

  const request = getProjectFaviconQuery(projectId).catch(() => null)
  projectFaviconCache.set(projectId, request)
  return request
}

export function ProjectBrandIcon({ project, size = 13 }: { project: Project; size?: number }) {
  const [favicon, setFavicon] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setFavicon(null)
    void getCachedProjectFavicon(project.id).then((nextFavicon) => {
      if (!cancelled) setFavicon(nextFavicon)
    })
    return () => {
      cancelled = true
    }
  }, [project.id])

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

  return project.repoOriginUrl ? (
    <GitHubInvertocatMark size={size} className="sidebar-project-work-project-origin-icon" />
  ) : (
    <FolderCode size={size} />
  )
}
