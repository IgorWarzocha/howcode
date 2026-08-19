import type {
  PiConfiguredPackage,
  PiConfiguredSkill,
  PiPackageCatalogPage,
  PiPackageMutationResult,
  PiSkillCatalogPage,
  PiSkillMutationResult,
} from '../desktop/types'

export function canSearchPiPackagesQuery() {
  return typeof window !== 'undefined' && typeof window.piDesktop?.searchPiPackages === 'function'
}

export function canSearchPiSkillsQuery() {
  return typeof window !== 'undefined' && typeof window.piDesktop?.searchPiSkills === 'function'
}

export async function searchPiPackagesQuery(
  request: {
    query?: string | null | undefined
    cursor?: number | null | undefined
    pageSize?: number | null | undefined
  } = {},
): Promise<PiPackageCatalogPage> {
  return (
    (await window.piDesktop?.searchPiPackages?.(request)) ?? {
      query: request.query?.trim() ?? '',
      sort: 'monthlyDownloads-desc',
      total: 0,
      nextCursor: null,
      items: [],
    }
  )
}

export async function searchPiSkillsQuery(
  request: { query?: string | null | undefined; limit?: number | null | undefined } = {},
): Promise<PiSkillCatalogPage> {
  return (
    (await window.piDesktop?.searchPiSkills?.(request)) ?? {
      query: request.query?.trim() ?? '',
      total: 0,
      items: [],
    }
  )
}

export async function getConfiguredPiPackagesQuery(
  request: { projectPath?: string | null | undefined; chat?: boolean | undefined } = {},
): Promise<PiConfiguredPackage[]> {
  return (await window.piDesktop?.getConfiguredPiPackages?.(request)) ?? []
}

export async function installPiPackageQuery(request: {
  source: string
  kind?: 'npm' | 'git' | undefined
  local?: boolean | undefined
  projectPath?: string | null
  chat?: boolean | undefined
}): Promise<PiPackageMutationResult | null> {
  return (await window.piDesktop?.installPiPackage?.(request)) ?? null
}

export async function removePiPackageQuery(request: {
  source: string
  local?: boolean | undefined
  projectPath?: string | null
  chat?: boolean | undefined
}): Promise<PiPackageMutationResult | null> {
  return (await window.piDesktop?.removePiPackage?.(request)) ?? null
}

export async function getConfiguredPiSkillsQuery(
  request: { projectPath?: string | null | undefined; chat?: boolean | undefined } = {},
): Promise<PiConfiguredSkill[]> {
  return (await window.piDesktop?.getConfiguredPiSkills?.(request)) ?? []
}

export async function installPiSkillQuery(request: {
  source: string
  local?: boolean | undefined
  projectPath?: string | null
  chat?: boolean | undefined
}): Promise<PiSkillMutationResult | null> {
  return (await window.piDesktop?.installPiSkill?.(request)) ?? null
}

export async function removePiSkillQuery(request: {
  installedPath: string
  projectPath?: string | null
  chat?: boolean | undefined
}): Promise<PiSkillMutationResult | null> {
  return (await window.piDesktop?.removePiSkill?.(request)) ?? null
}
