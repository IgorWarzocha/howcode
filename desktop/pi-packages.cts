import { existsSync } from "node:fs";
import path from "node:path";
import type {
  PiConfiguredPackage,
  PiPackageCatalogItem,
  PiPackageCatalogPage,
  PiPackageMutationResult,
} from "../shared/desktop-contracts.ts";
import { getPiModule } from "./pi-module.cts";
import {
  getConfiguredPiPackageDisplayName,
  getConfiguredPiPackageType,
  getPiPackageIdentityKey,
  normalizePiPackageSource,
  sortPiPackageCatalogItems,
} from "./pi-packages.helpers.ts";

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

type PiConfiguredPackageRecord = {
  resourceKind: "package" | "extension";
  source: string;
  scope: "user" | "project";
  filtered: boolean;
  installedPath?: string;
  settingsPath: string;
};

type PiSettingsPackageSource =
  | string
  | {
      source: string;
      extensions?: string[];
      skills?: string[];
      prompts?: string[];
      themes?: string[];
    };

type PiSettingsManager = {
  getGlobalSettings: () => { packages?: PiSettingsPackageSource[]; extensions?: string[] };
  getProjectSettings: () => { packages?: PiSettingsPackageSource[]; extensions?: string[] };
};

type PiPackageManager = {
  getInstalledPath: (source: string, scope: "user" | "project") => string | undefined;
  installAndPersist: (source: string, options?: { local?: boolean }) => Promise<void>;
  removeAndPersist: (source: string, options?: { local?: boolean }) => Promise<boolean>;
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

async function getPiPackageServices(projectPath?: string | null): Promise<{
  packageManager: PiPackageManager;
  settingsManager: PiSettingsManager;
  agentDir: string;
}> {
  const { DefaultPackageManager, SettingsManager, getAgentDir } = await getPiModule();
  const agentDir = getAgentDir();
  const cwd = projectPath?.trim() ? path.resolve(projectPath) : agentDir;
  const settingsManager = SettingsManager.create(cwd, agentDir);

  return {
    packageManager: new DefaultPackageManager({
      cwd,
      agentDir,
      settingsManager,
    }) as unknown as PiPackageManager,
    settingsManager: settingsManager as unknown as PiSettingsManager,
    agentDir,
  };
}

function sortConfiguredPackages(packages: PiConfiguredPackage[]) {
  return [...packages].sort((left, right) => {
    if (left.scope !== right.scope) {
      return left.scope === "user" ? -1 : 1;
    }

    return left.displayName.localeCompare(right.displayName, undefined, {
      sensitivity: "base",
    });
  });
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

export async function listConfiguredPiPackages(
  request: {
    projectPath?: string | null;
  } = {},
): Promise<PiConfiguredPackage[]> {
  const { packageManager, settingsManager, agentDir } = await getPiPackageServices(
    request.projectPath,
  );
  const configuredPackages: PiConfiguredPackageRecord[] = [];
  const projectPath = request.projectPath?.trim() ? path.resolve(request.projectPath) : null;
  const globalSettingsPath = path.join(agentDir, "settings.json");
  const projectSettingsPath = projectPath ? path.join(projectPath, ".pi", "settings.json") : null;

  const appendPackages = (scope: "user" | "project", packageSources: PiSettingsPackageSource[]) => {
    for (const packageSource of packageSources) {
      const source = typeof packageSource === "string" ? packageSource : packageSource.source;
      const settingsPath = scope === "user" ? globalSettingsPath : projectSettingsPath;

      if (!settingsPath) {
        continue;
      }

      configuredPackages.push({
        resourceKind: "package",
        source,
        scope,
        filtered: typeof packageSource === "object",
        installedPath: packageManager.getInstalledPath(source, scope),
        settingsPath,
      });
    }
  };

  const appendExtensions = (scope: "user" | "project", extensionPaths: string[]) => {
    const settingsPath = scope === "user" ? globalSettingsPath : projectSettingsPath;

    if (!settingsPath) {
      return;
    }

    for (const extensionPath of extensionPaths) {
      configuredPackages.push({
        resourceKind: "extension",
        source: extensionPath,
        scope,
        filtered: false,
        installedPath: existsSync(extensionPath) ? extensionPath : undefined,
        settingsPath,
      });
    }
  };

  const globalSettings = settingsManager.getGlobalSettings();
  const projectSettings = settingsManager.getProjectSettings();

  appendPackages("user", globalSettings.packages ?? []);
  appendPackages("project", projectSettings.packages ?? []);
  appendExtensions("user", globalSettings.extensions ?? []);
  appendExtensions("project", projectSettings.extensions ?? []);

  return sortConfiguredPackages(
    configuredPackages.map((configuredPackage) => ({
      resourceKind: configuredPackage.resourceKind,
      source: configuredPackage.source,
      identityKey: getPiPackageIdentityKey(configuredPackage.source),
      displayName: getConfiguredPiPackageDisplayName(configuredPackage.source),
      type: getConfiguredPiPackageType(configuredPackage.source),
      scope: configuredPackage.scope,
      filtered: configuredPackage.filtered,
      installedPath: configuredPackage.installedPath ?? null,
      settingsPath: configuredPackage.settingsPath,
    })),
  );
}

export async function installPiPackage(request: {
  source: string;
  kind?: "npm" | "git";
  local?: boolean;
  projectPath?: string | null;
}): Promise<PiPackageMutationResult> {
  const normalizedSource = normalizePiPackageSource(request.source, request.kind ?? "npm");

  if (!normalizedSource) {
    throw new Error("Enter a package source.");
  }

  const { packageManager } = await getPiPackageServices(request.projectPath);
  await packageManager.installAndPersist(normalizedSource, request.local ? { local: true } : {});

  return {
    source: request.source,
    normalizedSource,
    configuredPackages: await listConfiguredPiPackages({
      projectPath: request.projectPath ?? null,
    }),
  };
}

export async function removePiPackage(request: {
  source: string;
  local?: boolean;
  projectPath?: string | null;
}): Promise<PiPackageMutationResult> {
  const source = request.source.trim();

  if (source.length === 0) {
    throw new Error("Choose a package to remove.");
  }

  const { packageManager } = await getPiPackageServices(request.projectPath);
  await packageManager.removeAndPersist(source, request.local ? { local: true } : {});

  return {
    source,
    normalizedSource: source,
    configuredPackages: await listConfiguredPiPackages({
      projectPath: request.projectPath ?? null,
    }),
  };
}
