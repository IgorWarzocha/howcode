import type { Artifact } from '../../../desktop/types'

export function formatArtifactSlug(slug: string) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(' ')
}

export function getArtifactExtension(kind: Artifact['kind']) {
  if (kind === 'react') return 'tsx'
  if (kind === 'markdown') return 'md'
  return 'html'
}
