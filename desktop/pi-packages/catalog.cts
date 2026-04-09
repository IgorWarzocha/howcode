import type { PiPackageCatalogItem, PiPackageCatalogPage } from "../../shared/desktop-contracts.ts";
import { sortPiPackageCatalogItems } from "./helpers";

const npmRegistrySearchUrl = "https://registry.npmjs.org/-/v1/search";
const defaultCatalogPageSize = 20;
const catalogCacheTtlMs = 5 * 60_000;

type RegistryPackageLinks = {
  homepage?: unknown;
  npm?: unknown;
  repository?: unknown;
};

type RegistryPackage = {
  name?: unknown;
  version?: unknown;
  description?: unknown;
  keywords?: unknown;
  date?: unknown;
  links?: RegistryPackageLinks;
};

type RegistrySearchObject = {
  downloads?: {
    monthly?: unknown;
    weekly?: unknown;
  };
  searchScore?: unknown;
  updated?: unknown;
  package?: RegistryPackage;
};

type RegistrySearchResponse = {
  total?: unknown;
  objects?: RegistrySearchObject[];
};

type CatalogCacheEntry = {
  expiresAt: number;
  page?: PiPackageCatalogPage;
  promise?: Promise<PiPackageCatalogPage>;
};

const catalogCache = new Map<string, CatalogCacheEntry>();

function normalizeCatalogQuery(query?: string | null) {
  return query?.trim() ?? "";
}

function clampPageSize(pageSize?: number | null) {
  if (typeof pageSize !== "number" || !Number.isFinite(pageSize)) {
    return defaultCatalogPageSize;
  }

  return Math.max(1, Math.min(defaultCatalogPageSize, Math.floor(pageSize)));
}

function clampCursor(cursor?: number | null) {
  if (typeof cursor !== "number" || !Number.isFinite(cursor)) {
    return 0;
  }

  return Math.max(0, Math.floor(cursor));
}

function buildRegistrySearchText(query: string) {
  return query.length > 0 ? `keywords:pi-package ${query}` : "keywords:pi-package";
}

function isPiPackageKeyword(keyword: string) {
  return keyword.trim().toLowerCase() === "pi-package";
}

function mapRegistryObjectToCatalogItem(object: RegistrySearchObject): PiPackageCatalogItem | null {
  const packageRecord = object.package;
  const packageName = typeof packageRecord?.name === "string" ? packageRecord.name : null;

  if (!packageName) {
    return null;
  }

  const keywords = Array.isArray(packageRecord?.keywords)
    ? packageRecord.keywords.filter((keyword): keyword is string => typeof keyword === "string")
    : [];

  if (!keywords.some(isPiPackageKeyword)) {
    return null;
  }

  const npmUrl =
    typeof packageRecord?.links?.npm === "string"
      ? packageRecord.links.npm
      : `https://www.npmjs.com/package/${packageName}`;

  return {
    name: packageName,
    version: typeof packageRecord?.version === "string" ? packageRecord.version : "0.0.0",
    description:
      typeof packageRecord?.description === "string" && packageRecord.description.trim().length > 0
        ? packageRecord.description.trim()
        : null,
    keywords,
    monthlyDownloads:
      typeof object.downloads?.monthly === "number" && Number.isFinite(object.downloads.monthly)
        ? object.downloads.monthly
        : 0,
    weeklyDownloads:
      typeof object.downloads?.weekly === "number" && Number.isFinite(object.downloads.weekly)
        ? object.downloads.weekly
        : 0,
    searchScore:
      typeof object.searchScore === "number" && Number.isFinite(object.searchScore)
        ? object.searchScore
        : 0,
    publishedAt:
      typeof packageRecord?.date === "string" ? packageRecord.date : new Date(0).toISOString(),
    updatedAt:
      typeof object.updated === "string"
        ? object.updated
        : typeof packageRecord?.date === "string"
          ? packageRecord.date
          : new Date(0).toISOString(),
    npmUrl,
    homepageUrl:
      typeof packageRecord?.links?.homepage === "string" ? packageRecord.links.homepage : null,
    repositoryUrl:
      typeof packageRecord?.links?.repository === "string" ? packageRecord.links.repository : null,
    source: `npm:${packageName}`,
    identityKey: `npm:${packageName}`,
  };
}

async function fetchRegistryPage(query: string, from: number) {
  const requestUrl = new URL(npmRegistrySearchUrl);
  requestUrl.searchParams.set("text", buildRegistrySearchText(query));
  requestUrl.searchParams.set("from", String(from));
  requestUrl.searchParams.set("size", String(defaultCatalogPageSize));

  const response = await fetch(requestUrl, {
    headers: {
      accept: "application/json",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`npm search failed (${response.status})`);
  }

  return (await response.json()) as RegistrySearchResponse;
}

async function loadCatalog(
  query: string,
  cursor: number,
  pageSize: number,
): Promise<PiPackageCatalogPage> {
  const response = await fetchRegistryPage(query, cursor);
  const objects = Array.isArray(response.objects) ? response.objects : [];
  const total = typeof response.total === "number" ? response.total : objects.length;
  const items = sortPiPackageCatalogItems(
    objects
      .map((object) => mapRegistryObjectToCatalogItem(object))
      .filter((item): item is PiPackageCatalogItem => item !== null),
  ).slice(0, pageSize);

  return {
    query,
    sort: "monthlyDownloads-desc",
    total,
    nextCursor: cursor + objects.length < total ? cursor + objects.length : null,
    items,
  };
}

async function getCatalog(query: string, cursor: number, pageSize: number) {
  const cacheKey = `${query.toLowerCase()}:${cursor}:${pageSize}`;
  const cachedEntry = catalogCache.get(cacheKey);

  if (cachedEntry?.page && cachedEntry.expiresAt > Date.now()) {
    return cachedEntry.page;
  }

  if (cachedEntry?.promise) {
    return cachedEntry.promise;
  }

  const promise = loadCatalog(query, cursor, pageSize)
    .then((page) => {
      catalogCache.set(cacheKey, {
        page,
        expiresAt: Date.now() + catalogCacheTtlMs,
      });

      return page;
    })
    .catch((error) => {
      catalogCache.delete(cacheKey);
      throw error;
    });

  catalogCache.set(cacheKey, {
    promise,
    expiresAt: Date.now() + catalogCacheTtlMs,
  });

  return promise;
}

export async function searchPiPackages(
  request: {
    query?: string | null;
    cursor?: number | null;
    pageSize?: number | null;
  } = {},
): Promise<PiPackageCatalogPage> {
  const query = normalizeCatalogQuery(request.query);
  const pageSize = clampPageSize(request.pageSize);
  const cursor = clampCursor(request.cursor);
  return await getCatalog(query, cursor, pageSize);
}
