export type ParsedSkillSource = {
  repo: string;
  slug: string;
  normalizedSource: string;
};

export function normalizeSearchQuery(query?: string | null) {
  return query?.trim() ?? "";
}

export function clampResultLimit(limit?: number | null) {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return 12;
  }

  return Math.max(6, Math.min(24, Math.floor(limit)));
}

export function normalizeSkillSource(source: string) {
  return source.trim().toLowerCase();
}

export function getSkillIdentityKey(source: string) {
  return normalizeSkillSource(source);
}

export function parseSkillSource(source: string): ParsedSkillSource | null {
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
