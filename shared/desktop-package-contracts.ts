export type PiPackageCatalogItem = {
  name: string
  version: string
  description: string | null
  keywords: string[]
  monthlyDownloads: number
  weeklyDownloads: number
  searchScore: number
  publishedAt: string
  updatedAt: string
  npmUrl: string
  homepageUrl: string | null
  repositoryUrl: string | null
  source: string
  identityKey: string
}

export type PiPackageCatalogPage = {
  query: string
  sort: 'monthlyDownloads-desc'
  total: number
  nextCursor: number | null
  items: PiPackageCatalogItem[]
}

export type PiConfiguredPackage = typeof PiConfiguredPackageSchema.Type
export type PiConfiguredPackageType = PiConfiguredPackage['type']

export type PiPackageMutationResult = typeof PiPackageMutationResultSchema.Type

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

import type {
  PiConfiguredPackageSchema,
  PiConfiguredSkillSchema,
  PiPackageMutationResultSchema,
  PiSkillMutationResultSchema,
} from './desktop-package-schema'
