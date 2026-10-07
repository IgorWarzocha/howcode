import type {
  PiConfiguredSkill,
  PiSkillCatalogPage,
  PiSkillMutationResult,
} from '../../../src/app/desktop/types'

export function canSearchPiSkillsQuery() {
  return typeof window !== 'undefined' && typeof window.piDesktop?.searchPiSkills === 'function'
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
