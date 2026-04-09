import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  PiConfiguredSkill,
  PiSkillCatalogItem,
  PiSkillCatalogPage,
  PiSkillMutationResult,
} from "../shared/desktop-contracts.ts";

const skillsApiBaseUrl = process.env.HOWCODE_SKILLS_API_URL || "https://skills.sh";
const catalogCacheTtlMs = 5 * 60_000;
const fetchTimeoutMs = 15_000;
const installedSkillMetadataFileName = ".howcode-skill.json";

type SkillSearchApiItem = {
  id?: unknown;
  skillId?: unknown;
  name?: unknown;
  installs?: unknown;
  source?: unknown;
};

type SkillSearchApiResponse = {
  query?: unknown;
  count?: unknown;
  skills?: SkillSearchApiItem[];
};

type SkillDownloadApiFile = {
  path?: unknown;
  contents?: unknown;
};

type SkillDownloadApiResponse = {
  files?: SkillDownloadApiFile[];
  hash?: unknown;
};

type InstalledSkillMetadata = {
  source: string;
  repo: string;
  slug: string;
  url: string;
  sourceUrl: string;
  description: string | null;
  hash: string | null;
  installedAt: string;
};

type ParsedSkillSource = {
  repo: string;
  slug: string;
  normalizedSource: string;
};

type CatalogCacheEntry = {
  expiresAt: number;
  items?: PiSkillCatalogItem[];
  promise?: Promise<PiSkillCatalogItem[]>;
};

const catalogCache = new Map<string, CatalogCacheEntry>();
const detailCache = new Map<string, { description: string | null; hash: string | null }>();

function normalizeSearchQuery(query?: string | null) {
  return query?.trim() ?? "";
}

function clampResultLimit(limit?: number | null) {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return 12;
  }

  return Math.max(6, Math.min(24, Math.floor(limit)));
}

function getGlobalSkillsDir() {
  return path.join(os.homedir(), ".pi", "agent", "skills");
}

function getProjectSkillsDir(projectPath?: string | null) {
  if (!projectPath?.trim()) {
    return null;
  }

  return path.join(path.resolve(projectPath), ".pi", "skills");
}

function normalizeSkillSource(source: string) {
  return source.trim().toLowerCase();
}

function isValidSkillSlug(slug: string) {
  const trimmedSlug = slug.trim();

  return (
    trimmedSlug.length > 0 &&
    trimmedSlug !== "." &&
    trimmedSlug !== ".." &&
    !trimmedSlug.includes("/") &&
    !trimmedSlug.includes("\\")
  );
}

function getSkillIdentityKey(source: string) {
  return normalizeSkillSource(source);
}

function normalizeSkillName(value: string) {
  return value.trim().replace(/^['"]|['"]$/g, "");
}

function extractFrontmatter(markdown: string) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  return match?.[1] ?? null;
}

function parseSkillFrontmatter(markdown: string) {
  const frontmatter = extractFrontmatter(markdown);
  if (!frontmatter) {
    return { name: null, description: null };
  }

  const lines = frontmatter.replace(/\r/g, "").split("\n");
  let name: string | null = null;
  let description: string | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";

    const nameMatch = line.match(/^name:\s*(.+?)\s*$/);
    if (nameMatch) {
      name = normalizeSkillName(nameMatch[1]);
      continue;
    }

    const descriptionMatch = line.match(/^description:\s*(.*)$/);
    if (!descriptionMatch) {
      continue;
    }

    const rawDescription = descriptionMatch[1]?.trim() ?? "";
    if (["|", ">", "|-", ">-", "|+", ">+"].includes(rawDescription)) {
      const blockLines: string[] = [];

      for (index += 1; index < lines.length; index += 1) {
        const blockLine = lines[index] ?? "";

        if (blockLine.trim().length === 0) {
          blockLines.push("");
          continue;
        }

        if (!/^\s+/.test(blockLine)) {
          index -= 1;
          break;
        }

        blockLines.push(blockLine.replace(/^\s{2}/, ""));
      }

      description = blockLines.join("\n").trim().replace(/\s+/g, " ");
      continue;
    }

    description = normalizeSkillName(rawDescription);
  }

  return {
    name,
    description,
  };
}

function parseSkillSource(source: string): ParsedSkillSource | null {
  const trimmedSource = source.trim();
  if (trimmedSource.length === 0) {
    return null;
  }

  const skillsShMatch = trimmedSource.match(
    /^(?:https?:\/\/)?skills\.sh\/([^/]+)\/([^/]+)\/([^/?#]+)\/?$/i,
  );

  if (skillsShMatch) {
    const [, owner, repo, slug] = skillsShMatch;
    return {
      repo: `${owner}/${repo}`,
      slug,
      normalizedSource: `${owner}/${repo}@${slug}`.toLowerCase(),
    };
  }

  const repoSkillMatch = trimmedSource.match(/^([^/\s]+\/[^@\s]+)@([^\s]+)$/);
  if (!repoSkillMatch) {
    return null;
  }

  const [, repo, slug] = repoSkillMatch;
  return {
    repo,
    slug,
    normalizedSource: `${repo}@${slug}`.toLowerCase(),
  };
}

async function pathExists(targetPath: string) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function fetchJson<T>(requestUrl: string): Promise<T> {
  const response = await fetch(requestUrl, {
    headers: {
      accept: "application/json",
    },
    signal: AbortSignal.timeout(fetchTimeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }

  return (await response.json()) as T;
}

async function fetchSkillDetails(skill: { id: string; source: string; name: string }) {
  const cacheKey = `${skill.source}/${skill.name}`.toLowerCase();
  const cached = detailCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const download = await fetchJson<SkillDownloadApiResponse>(
    `${skillsApiBaseUrl}/api/download/${skill.source
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/")}/${encodeURIComponent(skill.name)}`,
  );
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
  const response = await fetchJson<SkillSearchApiResponse>(
    `${skillsApiBaseUrl}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`,
  );
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
        url: `${skillsApiBaseUrl}/${id}`,
        sourceUrl: `https://github.com/${source}`,
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

async function readInstalledSkillMetadata(skillDirPath: string) {
  try {
    const metadata = await readFile(
      path.join(skillDirPath, installedSkillMetadataFileName),
      "utf8",
    );
    return JSON.parse(metadata) as InstalledSkillMetadata;
  } catch {
    return null;
  }
}

async function listSkillsInDirectory(
  skillsDirPath: string,
  scope: PiConfiguredSkill["scope"],
): Promise<PiConfiguredSkill[]> {
  if (!(await pathExists(skillsDirPath))) {
    return [];
  }

  const directoryEntries = await readdir(skillsDirPath, { withFileTypes: true });
  const skills: PiConfiguredSkill[] = [];

  for (const entry of directoryEntries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const skillDirPath = path.join(skillsDirPath, entry.name);
    const skillFilePath = path.join(skillDirPath, "SKILL.md");

    if (!(await pathExists(skillFilePath))) {
      continue;
    }

    const markdown = await readFile(skillFilePath, "utf8");
    const frontmatter = parseSkillFrontmatter(markdown);
    const metadata = await readInstalledSkillMetadata(skillDirPath);
    const source = metadata?.source ?? `local:${skillDirPath}`;

    skills.push({
      source,
      identityKey: metadata?.source
        ? getSkillIdentityKey(metadata.source)
        : `local:${skillDirPath}`,
      displayName: frontmatter.name ?? entry.name,
      description: metadata?.description ?? frontmatter.description ?? null,
      scope,
      provenance: metadata ? "skills.sh" : "local",
      installedPath: skillDirPath,
      skillFilePath,
      sourceRepo: metadata?.repo ?? null,
      sourceUrl: metadata?.url ?? null,
    });
  }

  return skills.sort((left, right) =>
    left.displayName.localeCompare(right.displayName, undefined, { sensitivity: "base" }),
  );
}

function sortConfiguredSkills(skills: PiConfiguredSkill[]) {
  return [...skills].sort((left, right) => {
    if (left.scope !== right.scope) {
      return left.scope === "user" ? -1 : 1;
    }

    return left.displayName.localeCompare(right.displayName, undefined, { sensitivity: "base" });
  });
}

function isPathWithinRoot(candidatePath: string, rootPath: string) {
  const relativePath = path.relative(rootPath, candidatePath);
  return (
    relativePath.length === 0 || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  );
}

async function writeDownloadedSkill(
  targetDirPath: string,
  files: SkillDownloadApiFile[],
  metadata: InstalledSkillMetadata,
) {
  await mkdir(targetDirPath, { recursive: true });

  for (const file of files) {
    if (typeof file.path !== "string" || typeof file.contents !== "string") {
      continue;
    }

    const targetFilePath = path.resolve(targetDirPath, file.path);
    if (!isPathWithinRoot(targetFilePath, targetDirPath)) {
      throw new Error("Downloaded skill contains an invalid file path.");
    }

    await mkdir(path.dirname(targetFilePath), { recursive: true });
    await writeFile(targetFilePath, file.contents, "utf8");
  }

  await writeFile(
    path.join(targetDirPath, installedSkillMetadataFileName),
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8",
  );
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

export async function listConfiguredPiSkills(
  request: { projectPath?: string | null } = {},
): Promise<PiConfiguredSkill[]> {
  const globalSkills = await listSkillsInDirectory(getGlobalSkillsDir(), "user");
  const projectSkillsDir = getProjectSkillsDir(request.projectPath);
  const projectSkills = projectSkillsDir
    ? await listSkillsInDirectory(projectSkillsDir, "project")
    : [];

  return sortConfiguredSkills([...globalSkills, ...projectSkills]);
}

export async function installPiSkill(request: {
  source: string;
  local?: boolean;
  projectPath?: string | null;
}): Promise<PiSkillMutationResult> {
  const parsedSource = parseSkillSource(request.source);
  if (!parsedSource) {
    throw new Error(
      "Enter a skill source like owner/repo@skill or https://skills.sh/owner/repo/skill.",
    );
  }

  const download = await fetchJson<SkillDownloadApiResponse>(
    `${skillsApiBaseUrl}/api/download/${parsedSource.repo
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/")}/${encodeURIComponent(parsedSource.slug)}`,
  );
  const files = Array.isArray(download.files) ? download.files : [];

  if (files.length === 0) {
    throw new Error("Could not download that skill.");
  }

  const targetRootPath = request.local
    ? getProjectSkillsDir(request.projectPath)
    : getGlobalSkillsDir();
  if (!targetRootPath) {
    throw new Error("Select a project before installing a project-scoped skill.");
  }

  if (!isValidSkillSlug(parsedSource.slug)) {
    throw new Error("That skill has an invalid slug.");
  }

  const targetDirPath = path.resolve(targetRootPath, parsedSource.slug);
  if (!isPathWithinRoot(targetDirPath, targetRootPath)) {
    throw new Error("That skill resolves outside the skills directory.");
  }

  const existingMetadata = await readInstalledSkillMetadata(targetDirPath);
  if (
    (await pathExists(targetDirPath)) &&
    existingMetadata?.source &&
    getSkillIdentityKey(existingMetadata.source) !==
      getSkillIdentityKey(parsedSource.normalizedSource)
  ) {
    throw new Error(
      `A different skill is already installed at ${parsedSource.slug}. Remove it first.`,
    );
  }

  if ((await pathExists(targetDirPath)) && !existingMetadata) {
    throw new Error(
      `A custom skill already exists at ${parsedSource.slug}. Remove or rename it first.`,
    );
  }

  await rm(targetDirPath, { recursive: true, force: true });
  await mkdir(targetRootPath, { recursive: true });

  const skillFile = files.find((file) => file.path === "SKILL.md");
  const frontmatter = parseSkillFrontmatter(
    typeof skillFile?.contents === "string" ? skillFile.contents : "",
  );

  await writeDownloadedSkill(targetDirPath, files, {
    source: parsedSource.normalizedSource,
    repo: parsedSource.repo,
    slug: parsedSource.slug,
    url: `${skillsApiBaseUrl}/${parsedSource.repo}/${parsedSource.slug}`,
    sourceUrl: `https://github.com/${parsedSource.repo}`,
    description: frontmatter.description,
    hash: typeof download.hash === "string" ? download.hash : null,
    installedAt: new Date().toISOString(),
  });

  return {
    source: request.source,
    normalizedSource: parsedSource.normalizedSource,
    configuredSkills: await listConfiguredPiSkills({
      projectPath: request.projectPath ?? null,
    }),
  };
}

export async function removePiSkill(request: {
  installedPath: string;
  projectPath?: string | null;
}): Promise<PiSkillMutationResult> {
  const installedPath = path.resolve(request.installedPath);
  const globalRootPath = getGlobalSkillsDir();
  const projectRootPath = getProjectSkillsDir(request.projectPath);

  if (
    !isPathWithinRoot(installedPath, globalRootPath) &&
    !(projectRootPath && isPathWithinRoot(installedPath, projectRootPath))
  ) {
    throw new Error("That skill cannot be removed from here.");
  }

  const metadata = await readInstalledSkillMetadata(installedPath);
  await rm(installedPath, { recursive: true, force: true });

  return {
    source: metadata?.source ?? installedPath,
    normalizedSource: metadata?.source ? normalizeSkillSource(metadata.source) : installedPath,
    configuredSkills: await listConfiguredPiSkills({
      projectPath: request.projectPath ?? null,
    }),
  };
}
