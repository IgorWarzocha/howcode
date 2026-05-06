import type { PiPackageCatalogItem, PiPackageCatalogPage } from '../../shared/desktop-contracts.ts'
import { sortPiPackageCatalogItems } from './helpers'

const npmRegistrySearchUrl = 'https://registry.npmjs.org/-/v1/search'
const defaultCatalogPageSize = 20
const catalogCacheTtlMs = 5 * 60_000

type RegistryPackageLinks = {
  homepage?: unknown
  npm?: unknown
  repository?: unknown
}

type RegistryPackage = {
  name?: unknown
  version?: unknown
  description?: unknown
  keywords?: unknown
  date?: unknown
  links?: RegistryPackageLinks
}

type RegistrySearchObject = {
  downloads?: {
    monthly?: unknown
    weekly?: unknown
  }
  searchScore?: unknown
  updated?: unknown
  package?: RegistryPackage
}

type RegistrySearchResponse = {
  total?: unknown
  objects?: RegistrySearchObject[]
}

type CatalogCacheEntry = {
  expiresAt: number
  page?: PiPackageCatalogPage
  promise?: Promise<PiPackageCatalogPage>
}

const catalogCache = new Map<string, CatalogCacheEntry>()

function normalizeCatalogQuery(query?: string | undefined | null | undefined) {
  return query?.trim() ?? ''
}

function clampPageSize(pageSize?: number | undefined | null) {
  if (typeof pageSize !== 'number' || !Number.isFinite(pageSize)) {
    return defaultCatalogPageSize
  }

  return Math.max(1, Math.min(defaultCatalogPageSize, Math.floor(pageSize)))
}

function clampCursor(cursor?: number | undefined | null) {
  if (typeof cursor !== 'number' || !Number.isFinite(cursor)) {
    return 0
  }

  return Math.max(0, Math.floor(cursor))
}

function buildRegistrySearchText(query: string) {
  return query.length > 0 ? `keywords:pi-package ${query}` : 'keywords:pi-package'
}

function isPiPackageKeyword(keyword: string) {
  return keyword.trim().toLowerCase() === 'pi-package'
}

function getRegistryPackageString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function getRegistryPackageNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function getRegistryPackageDate(packageRecord: RegistryPackage | undefined, fallback?: unknown) {
  return (
    getRegistryPackageString(fallback) ??
    getRegistryPackageString(packageRecord?.date) ??
    new Date(0).toISOString()
  )
}

function mapRegistryObjectToCatalogItem(object: RegistrySearchObject): PiPackageCatalogItem | null {
  const packageRecord = object.package
  const packageName = typeof packageRecord?.name === 'string' ? packageRecord.name : null

  if (!packageName) {
    return null
  }

  const keywords = Array.isArray(packageRecord?.keywords)
    ? packageRecord.keywords.filter((keyword): keyword is string => typeof keyword === 'string')
    : []

  if (!keywords.some(isPiPackageKeyword)) {
    return null
  }

  const npmUrl =
    typeof packageRecord?.links?.npm === 'string'
      ? packageRecord.links.npm
      : `https://www.npmjs.com/package/${packageName}`

  return {
    name: packageName,
    version: getRegistryPackageString(packageRecord?.version) ?? '0.0.0',
    description: getRegistryPackageString(packageRecord?.description),
    keywords,
    monthlyDownloads: getRegistryPackageNumber(object.downloads?.monthly),
    weeklyDownloads: getRegistryPackageNumber(object.downloads?.weekly),
    searchScore: getRegistryPackageNumber(object.searchScore),
    publishedAt: getRegistryPackageDate(packageRecord),
    updatedAt: getRegistryPackageDate(packageRecord, object.updated),
    npmUrl,
    homepageUrl: getRegistryPackageString(packageRecord?.links?.homepage),
    repositoryUrl: getRegistryPackageString(packageRecord?.links?.repository),
    source: `npm:${packageName}`,
    identityKey: `npm:${packageName}`,
  }
}

async function fetchRegistryPage(query: string, from: number, size: number) {
  const requestUrl = new URL(npmRegistrySearchUrl)
  requestUrl.searchParams.set('text', buildRegistrySearchText(query))
  requestUrl.searchParams.set('from', String(from))
  requestUrl.searchParams.set('size', String(size))

  const response = await fetch(requestUrl, {
    headers: {
      accept: 'application/json',
    },
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) {
    throw new Error(`npm search failed (${response.status})`)
  }

  return (await response.json()) as RegistrySearchResponse
}

async function loadCatalog(
  query: string,
  cursor: number,
  pageSize: number,
): Promise<PiPackageCatalogPage> {
  const response = await fetchRegistryPage(query, cursor, pageSize)
  const objects = Array.isArray(response.objects) ? response.objects : []
  const total = typeof response.total === 'number' ? response.total : objects.length
  const items = sortPiPackageCatalogItems(
    objects
      .map((object) => mapRegistryObjectToCatalogItem(object))
      .filter((item): item is PiPackageCatalogItem => item !== null),
  )

  return {
    query,
    sort: 'monthlyDownloads-desc',
    total,
    nextCursor: cursor + objects.length < total ? cursor + objects.length : null,
    items,
  }
}

async function getCatalog(query: string, cursor: number, pageSize: number) {
  const cacheKey = `${query.toLowerCase()}:${cursor}:${pageSize}`
  const cachedEntry = catalogCache.get(cacheKey)

  if (cachedEntry?.page && cachedEntry.expiresAt > Date.now()) {
    return cachedEntry.page
  }

  if (cachedEntry?.promise) {
    return cachedEntry.promise
  }

  const promise = loadCatalog(query, cursor, pageSize)
    .then((page) => {
      catalogCache.set(cacheKey, {
        page,
        expiresAt: Date.now() + catalogCacheTtlMs,
      })

      return page
    })
    .catch((error) => {
      catalogCache.delete(cacheKey)
      throw error
    })

  catalogCache.set(cacheKey, {
    promise,
    expiresAt: Date.now() + catalogCacheTtlMs,
  })

  return promise
}

export async function searchPiPackages(
  request: {
    query?: string | undefined | null | undefined
    cursor?: number | undefined | null
    pageSize?: number | undefined | null
  } = {},
): Promise<PiPackageCatalogPage> {
  const query = normalizeCatalogQuery(request.query)
  const pageSize = clampPageSize(request.pageSize)
  const cursor = clampCursor(request.cursor)
  return await getCatalog(query, cursor, pageSize)
}
