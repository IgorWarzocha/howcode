export type GitHubRepositoryLink = {
  owner: string;
  repo: string;
  cloneUrl: string;
  sshUrl: string;
  canonicalUrl: string;
  folderName: string;
};

const githubHostPattern = /^(?:www\.)?github\.com$/i;

function cleanRepositoryName(repo: string) {
  return repo.replace(/\.git$/i, "").trim();
}

function buildGitHubRepositoryLink(
  owner: string,
  repo: string,
  cloneProtocol: "https" | "ssh" = "https",
): GitHubRepositoryLink | null {
  const cleanOwner = owner.trim();
  const cleanRepo = cleanRepositoryName(repo);

  if (!/^[A-Za-z0-9_.-]+$/.test(cleanOwner) || !/^[A-Za-z0-9_.-]+$/.test(cleanRepo)) {
    return null;
  }

  const httpsCloneUrl = `https://github.com/${cleanOwner}/${cleanRepo}.git`;
  const sshUrl = `git@github.com:${cleanOwner}/${cleanRepo}.git`;

  return {
    owner: cleanOwner,
    repo: cleanRepo,
    cloneUrl: cloneProtocol === "ssh" ? sshUrl : httpsCloneUrl,
    sshUrl,
    canonicalUrl: `https://github.com/${cleanOwner}/${cleanRepo}`,
    folderName: cleanRepo,
  };
}

export function parseGitHubRepositoryUrl(input: string): GitHubRepositoryLink | null {
  const value = input.trim();
  if (!value) {
    return null;
  }

  const sshMatch = value.match(/^git@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i);
  if (sshMatch) {
    return buildGitHubRepositoryLink(sshMatch[1] ?? "", sshMatch[2] ?? "", "ssh");
  }

  const shorthandMatch = value.match(/^github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i);
  if (shorthandMatch) {
    return buildGitHubRepositoryLink(shorthandMatch[1] ?? "", shorthandMatch[2] ?? "");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (
    !githubHostPattern.test(url.hostname) ||
    (url.protocol !== "https:" && url.protocol !== "http:")
  ) {
    return null;
  }

  const [owner, repo] = url.pathname.split("/").filter(Boolean);
  if (!owner || !repo) {
    return null;
  }

  return buildGitHubRepositoryLink(owner, repo);
}

export function normalizeGitHubRepositoryUrl(input: string) {
  const link = parseGitHubRepositoryUrl(input);
  return link?.canonicalUrl ?? null;
}

export function isSameGitHubRepository(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  const normalizedLeft = left ? normalizeGitHubRepositoryUrl(left) : null;
  const normalizedRight = right ? normalizeGitHubRepositoryUrl(right) : null;
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}
