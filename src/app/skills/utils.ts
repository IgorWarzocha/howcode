import { getSafeExternalUrl } from '@howcode/shared/external-url'
import type { PiConfiguredSkill, PiSkillCatalogItem } from '../desktop/types'
import { canSearchPiSkillsQuery, openExternalQuery } from '../query/desktop-query'
import { getActionError } from '../utils/action-error'

const compactNumberFormatter = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
})
const pathSeparatorPattern = /[\\/]+/

export { getActionError }

export function formatInstalls(installs: number) {
  return `${compactNumberFormatter.format(installs)} installs`
}

export function normalizeSkillSlug(slug: string) {
  return slug.trim().toLowerCase()
}

export function getCatalogSkillSource(skill: Pick<PiSkillCatalogItem, 'source' | 'skillId'>) {
  return `${skill.source}@${skill.skillId}`
}

export function isDesktopSkillsAvailable() {
  return canSearchPiSkillsQuery()
}

export async function openExternalUrl(url: string) {
  const safeUrl = getSafeExternalUrl(url)
  if (!safeUrl) {
    return false
  }

  if (await openExternalQuery(safeUrl)) return true

  window.open(safeUrl, '_blank', 'noopener,noreferrer')
  return true
}

function getPathBasename(targetPath: string) {
  const segments = targetPath.split(pathSeparatorPattern).filter(Boolean)
  return segments[segments.length - 1] ?? ''
}

export function getInstalledSkillSlugs(skills: PiConfiguredSkill[]) {
  return new Set(
    skills.flatMap((skill) => {
      const slug = normalizeSkillSlug(getPathBasename(skill.installedPath))
      return slug ? [slug] : []
    }),
  )
}
