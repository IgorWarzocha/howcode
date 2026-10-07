export type PiSkillCatalogItem = {
  id: string
  skillId: string
  name: string
  source: string
  installs: number
  description: string | null
  url: string
  sourceUrl: string
  identityKey: string
}

export type PiSkillCatalogPage = {
  query: string
  total: number
  items: PiSkillCatalogItem[]
}

export type PiConfiguredSkill = typeof PiConfiguredSkillSchema.Type

export type PiSkillMutationResult = typeof PiSkillMutationResultSchema.Type

import type { PiConfiguredSkillSchema, PiSkillMutationResultSchema } from './desktop-package-schema'
