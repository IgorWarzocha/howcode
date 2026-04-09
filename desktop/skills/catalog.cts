import type { PiSkillCatalogItem, PiSkillCatalogPage } from "../../shared/desktop-contracts.ts";
import { downloadSkillApi, getSkillsAppUrl, getSkillsSourceUrl, searchSkillsApi } from "./api.cts";
import { parseSkillFrontmatter } from "./frontmatter.cts";
import { clampResultLimit, getSkillIdentityKey, normalizeSearchQuery } from "./source.cts";

type CatalogCacheEntry = {
  expiresAt: number;
  items?: PiSkillCatalogItem[];
  promise?: Promise<PiSkillCatalogItem[]>;
};

const catalogCacheTtlMs = 5 * 60_000;
const catalogCache = new Map<string, CatalogCacheEntry>();
const detailCache = new Map<string, { description: string | null; hash: string | null }>();

async function fetchSkillDetails(skill: { id: string; source: string; name: string }) {
  const cacheKey = `${skill.source}/${skill.name}`.toLowerCase();
  const cached = detailCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const download = await downloadSkillApi(skill.source, skill.name);
  const skillFile = Array.isArray(download.files)
    ? download.files.find((file) => file.path === "SKILL.md")
    : null;
  const contents = typeof skillFile?.contents === "string" ? skillFile.contents : "";
  const { description } = parseSkillFrontmatter(contents);
  const details = {
    description,
    hash: typeof download.hash === "string" ? download.hash : null,
  };

  detailCache.set(cacheKey, details);
  return details;
}

async function loadCatalog(query: string, limit: number) {
  const response = await searchSkillsApi(query, limit);
  const skills = Array.isArray(response.skills) ? response.skills : [];

  const items = await Promise.all(
    skills.map(async (skill): Promise<PiSkillCatalogItem | null> => {
      const id = typeof skill.id === "string" ? skill.id : null;
      const name = typeof skill.name === "string" ? skill.name : null;
      const source = typeof skill.source === "string" ? skill.source : null;

      if (!id || !name || !source) {
        return null;
      }

      const details = await fetchSkillDetails({ id, source, name }).catch(() => ({
        description: null,
        hash: null,
      }));

      return {
        id,
        skillId: typeof skill.skillId === "string" ? skill.skillId : name,
        name,
        source,
        installs:
          typeof skill.installs === "number" && Number.isFinite(skill.installs)
            ? skill.installs
            : 0,
        description: details.description,
        url: getSkillsAppUrl(id),
        sourceUrl: getSkillsSourceUrl(source),
        identityKey: getSkillIdentityKey(`${source}@${name}`),
      };
    }),
  );

  return items.filter((item): item is PiSkillCatalogItem => item !== null);
}

async function getCatalog(query: string, limit: number) {
  const cacheKey = `${query.toLowerCase()}:${limit}`;
  const cached = catalogCache.get(cacheKey);

  if (cached?.items && cached.expiresAt > Date.now()) {
    return cached.items;
  }

  if (cached?.promise) {
    return cached.promise;
  }

  const promise = loadCatalog(query, limit)
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

export async function searchPiSkills(
  request: { query?: string | null; limit?: number | null } = {},
): Promise<PiSkillCatalogPage> {
  const query = normalizeSearchQuery(request.query);

  if (query.length < 2) {
    return {
      query,
      total: 0,
      items: [],
    };
  }

  const items = await getCatalog(query, clampResultLimit(request.limit));
  return {
    query,
    total: items.length,
    items,
  };
}
