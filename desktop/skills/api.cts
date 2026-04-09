const skillsApiBaseUrl = process.env.HOWCODE_SKILLS_API_URL || "https://skills.sh";
const fetchTimeoutMs = 15_000;

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

export type SkillDownloadApiFile = {
  path?: unknown;
  contents?: unknown;
};

type SkillDownloadApiResponse = {
  files?: SkillDownloadApiFile[];
  hash?: unknown;
};

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

function encodeRepoSegments(repo: string) {
  return repo
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export async function searchSkillsApi(query: string, limit: number) {
  return await fetchJson<SkillSearchApiResponse>(
    `${skillsApiBaseUrl}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`,
  );
}

export async function downloadSkillApi(repo: string, slug: string) {
  return await fetchJson<SkillDownloadApiResponse>(
    `${skillsApiBaseUrl}/api/download/${encodeRepoSegments(repo)}/${encodeURIComponent(slug)}`,
  );
}

export function getSkillsAppUrl(id: string) {
  return `${skillsApiBaseUrl}/${id}`;
}

export function getSkillsSourceUrl(source: string) {
  return `https://github.com/${source}`;
}
