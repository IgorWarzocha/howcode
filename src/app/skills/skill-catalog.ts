import type { searchPiSkillsQuery } from '../query/desktop-query'
import { getCatalogSkillSource } from './utils'

export type SkillCatalogItem = Awaited<ReturnType<typeof searchPiSkillsQuery>>['items'][number]

export function getSelectedSkillInstallSources(
  selectedSources: readonly string[],
  items: readonly SkillCatalogItem[],
) {
  const seenSources = new Set<string>()
  return selectedSources.flatMap((source) => {
    const item = items.find((candidate) => candidate.identityKey === source)
    const normalizedSource = item?.identityKey ?? source.trim().toLowerCase()
    if (!item || seenSources.has(normalizedSource)) return []
    seenSources.add(normalizedSource)
    return [getCatalogSkillSource(item)]
  })
}
