import * as Cache from 'effect/Cache'
import * as Duration from 'effect/Duration'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import type { PiSkillCatalogItem, PiSkillCatalogPage } from '../../shared/desktop-contracts.ts'
import { downloadSkillApi, getSkillsAppUrl, getSkillsSourceUrl, searchSkillsApi } from './api.ts'
import { parseSkillFrontmatter } from './frontmatter.ts'
import { clampResultLimit, getSkillIdentityKey, normalizeSearchQuery } from './source.ts'

const catalogCacheTtlMs = 5 * 60_000
const skillDetailCacheTtlMs = 60 * 60_000
const catalogCacheCapacity = 100
const skillDetailCacheCapacity = 500
const cacheKeySeparator = '\0'

async function loadSkillDetails(skill: { source: string; skillId: string }) {
  const download = await downloadSkillApi(skill.source, skill.skillId)
  const skillFile = Array.isArray(download.files)
    ? download.files.find((file) => file.path === 'SKILL.md')
    : null
  const contents = typeof skillFile?.contents === 'string' ? skillFile.contents : ''
  const { description } = parseSkillFrontmatter(contents)
  return {
    description,
    hash: typeof download.hash === 'string' ? download.hash : null,
  }
}

function splitCacheKey(key: string) {
  const separatorIndex = key.lastIndexOf(cacheKeySeparator)
  return [key.slice(0, separatorIndex), key.slice(separatorIndex + 1)] as const
}

const detailCache = Effect.runSync(
  Cache.makeWith(
    (key: string) => {
      const [source, skillId] = splitCacheKey(key)
      return Effect.tryPromise({
        try: () => loadSkillDetails({ source, skillId }),
        catch: (error) => error,
      })
    },
    {
      capacity: skillDetailCacheCapacity,
      timeToLive: (exit) => (Exit.isSuccess(exit) ? skillDetailCacheTtlMs : Duration.zero),
    },
  ),
)

function fetchSkillDetails(skill: { source: string; skillId: string }) {
  const cacheKey = `${skill.source}${cacheKeySeparator}${skill.skillId}`
  return Effect.runPromise(Cache.get(detailCache, cacheKey))
}

async function loadCatalog(query: string, limit: number) {
  const response = await searchSkillsApi(query, limit)
  const skills = Array.isArray(response.skills) ? response.skills : []

  const items = await Promise.all(
    skills.map(async (skill): Promise<PiSkillCatalogItem | null> => {
      const id = typeof skill.id === 'string' ? skill.id : null
      const skillId = typeof skill.skillId === 'string' ? skill.skillId : null
      const name = typeof skill.name === 'string' ? skill.name : null
      const source = typeof skill.source === 'string' ? skill.source : null

      if (!(id && skillId && name && source)) {
        return null
      }

      const details = await fetchSkillDetails({ source, skillId }).catch(() => ({
        description: null,
        hash: null,
      }))

      return {
        id,
        skillId,
        name,
        source,
        installs:
          typeof skill.installs === 'number' && Number.isFinite(skill.installs)
            ? skill.installs
            : 0,
        description: details.description,
        url: getSkillsAppUrl(id),
        sourceUrl: getSkillsSourceUrl(source),
        identityKey: getSkillIdentityKey(`${source}@${skillId}`),
      }
    }),
  )

  return items.filter((item): item is PiSkillCatalogItem => item !== null)
}

const catalogCache = Effect.runSync(
  Cache.makeWith(
    (key: string) => {
      const [query, rawLimit] = splitCacheKey(key)
      return Effect.tryPromise({
        try: () => loadCatalog(query, Number(rawLimit)),
        catch: (error) => error,
      })
    },
    {
      capacity: catalogCacheCapacity,
      timeToLive: (exit) => (Exit.isSuccess(exit) ? catalogCacheTtlMs : Duration.zero),
    },
  ),
)

function getCatalog(query: string, limit: number) {
  const cacheKey = `${query}${cacheKeySeparator}${limit}`
  return Effect.runPromise(Cache.get(catalogCache, cacheKey))
}

export async function searchPiSkills(
  request: {
    query?: string | undefined | null | undefined
    limit?: number | undefined | null
  } = {},
): Promise<PiSkillCatalogPage> {
  const query = normalizeSearchQuery(request.query)

  if (query.length < 2) {
    return {
      query,
      total: 0,
      items: [],
    }
  }

  const items = await getCatalog(query, clampResultLimit(request.limit))
  return {
    query,
    total: items.length,
    items,
  }
}
