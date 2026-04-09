import type { PiPackageCatalogItem, PiPackageCatalogPage } from "../../shared/desktop-contracts.ts";
import { sortPiPackageCatalogItems } from "./helpers.ts";

const npmRegistrySearchUrl = "https://registry.npmjs.org/-/v1/search";
const npmRegistryPageSize = 250;
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
  items?: PiPackageCatalogItem[];
  promise?: Promise<PiPackageCatalogItem[]>;
};

const catalogCache = new Map<string, CatalogCacheEntry>();

function normalizeCatalogQuery(query?: string | null) {
  return query?.trim() ?? "";
}

function clampPageSize(pageSize?: number | null) {
  if (typeof pageSize !== "number" || !Number.isFinite(pageSize)) {
    return 24;
  }

  return Math.max(12, Math.min(48, Math.floor(pageSize)));
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
  requestUrl.searchParams.set("size", String(npmRegistryPageSize));

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

async function loadCatalog(query: string) {
  const items: PiPackageCatalogItem[] = [];
  const seenPackageNames = new Set<string>();
  let from = 0;
  let total = 0;

  while (true) {
    const response = await fetchRegistryPage(query, from);
    const objects = Array.isArray(response.objects) ? response.objects : [];

    total = typeof response.total === "number" ? response.total : objects.length;

    for (const object of objects) {
      const item = mapRegistryObjectToCatalogItem(object);

      if (!item || seenPackageNames.has(item.name)) {
        continue;
      }

      seenPackageNames.add(item.name);
      items.push(item);
    }

    if (objects.length === 0 || from + objects.length >= total) {
      break;
    }

    from += objects.length;
  }

  return sortPiPackageCatalogItems(items);
}

async function getCatalog(query: string) {
  const cacheKey = query.toLowerCase();
  const cachedEntry = catalogCache.get(cacheKey);

  if (cachedEntry?.items && cachedEntry.expiresAt > Date.now()) {
    return cachedEntry.items;
  }

  if (cachedEntry?.promise) {
    return cachedEntry.promise;
  }

  const promise = loadCatalog(query)
    .then((items) => {
      catalogCache.set(cacheKey, {
        items,
        expiresAt: Date.now() + catalogCacheTtlMs,
      });

      return items;
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
  const catalog = await getCatalog(query);

  return {
    query,
    sort: "monthlyDownloads-desc",
    total: catalog.length,
    nextCursor: cursor + pageSize < catalog.length ? cursor + pageSize : null,
    items: catalog.slice(cursor, cursor + pageSize),
  };
}
