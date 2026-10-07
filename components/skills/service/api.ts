import * as Schema from 'effect/Schema'
import { SkillDownloadApiResponse, SkillSearchApiResponse } from './api-schema.ts'

function getProcessEnvironmentVariable(name: string) {
  return process.env[name]
}
const skillsApiBaseUrl =
  getProcessEnvironmentVariable('HOWCODE_SKILLS_API_URL') || 'https://skills.sh'
const fetchTimeoutMs = 15_000

async function fetchJson<S extends Schema.ConstraintDecoder<unknown>>(
  requestUrl: string,
  schema: S,
): Promise<S['Type']> {
  const response = await fetch(requestUrl, {
    headers: {
      accept: 'application/json',
    },
    signal: AbortSignal.timeout(fetchTimeoutMs),
  })

  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`)
  }

  return await Schema.decodeUnknownPromise(schema)(await response.json())
}

function encodeRepoSegments(repo: string) {
  return repo
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

export async function searchSkillsApi(query: string, limit: number) {
  return await fetchJson(
    `${skillsApiBaseUrl}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    SkillSearchApiResponse,
  )
}

export async function downloadSkillApi(repo: string, slug: string) {
  return await fetchJson(
    `${skillsApiBaseUrl}/api/download/${encodeRepoSegments(repo)}/${encodeURIComponent(slug)}`,
    SkillDownloadApiResponse,
  )
}

export function getSkillsAppUrl(id: string) {
  return `${skillsApiBaseUrl}/${id}`
}

export function getSkillsSourceUrl(source: string) {
  return `https://github.com/${source}`
}
