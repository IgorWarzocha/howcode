import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const versionPattern = /^\d+\.\d+\.\d+$/
const manifestPattern = /^stable-.*-update\.json$/
const archivePattern = /^archive-howcode-(?:linux|macos|win)-(?:arm64|x64)-[a-f0-9]{64}\.tar\.gz$/
const commitPattern = /^[a-f0-9]{40}$/

export type ChannelRetention = {
  revision: number
  commit: string
  complete: boolean
  baseline: string[]
  previous: string[]
  current: string[]
}

export function parseChannelRetention(value: unknown): ChannelRetention {
  if (!value || typeof value !== 'object') throw new Error('Invalid channel retention record')
  const record = value as Partial<ChannelRetention>
  if (
    typeof record.commit !== 'string' ||
    !commitPattern.test(record.commit) ||
    !Number.isSafeInteger(record.revision) ||
    (record.revision ?? 0) < 1 ||
    typeof record.complete !== 'boolean' ||
    !Array.isArray(record.baseline) ||
    !record.baseline.every((name) => typeof name === 'string' && archivePattern.test(name)) ||
    !Array.isArray(record.previous) ||
    !record.previous.every((name) => typeof name === 'string' && archivePattern.test(name)) ||
    !Array.isArray(record.current) ||
    !record.current.every((name) => typeof name === 'string' && archivePattern.test(name))
  ) {
    throw new Error('Invalid channel retention record')
  }
  return record as ChannelRetention
}

export function newestChannelRetention(
  records: readonly ChannelRetention[],
): ChannelRetention | undefined {
  return records.reduce<ChannelRetention | undefined>(
    (latest, record) =>
      !latest ||
      record.revision > latest.revision ||
      (record.revision === latest.revision && record.complete)
        ? record
        : latest,
    undefined,
  )
}

export function channelRetention(
  commit: string,
  advertised: ReadonlySet<string>,
  candidate: ReadonlySet<string>,
  existing?: ChannelRetention,
): ChannelRetention {
  const unchanged =
    existing?.complete &&
    existing.commit === commit &&
    existing.current.length === candidate.size &&
    existing.current.every((name) => candidate.has(name))
  // The baseline survives interrupted retries. Only the last partly advertised
  // candidate is added, so repeated failed rebuilds do not retain every hash.
  const baseline =
    existing && (!existing.complete || unchanged) ? existing.baseline : [...advertised]
  const previous =
    existing && unchanged ? new Set(existing.previous) : new Set([...baseline, ...advertised])
  return {
    revision: (existing?.revision ?? 0) + 1,
    commit,
    complete: false,
    baseline: [...baseline].sort(),
    previous: [...previous].sort(),
    current: [...candidate].sort(),
  }
}

export function releaseNotes(changelog: string, version: string) {
  if (!versionPattern.test(version)) throw new Error(`Invalid app version ${version}`)
  const section = /^###\s+([^\n]+)\s*\n([\s\S]*?)(?=^###\s+|$(?![\s\S]))/gm.exec(changelog)
  if (!section || section[1]?.trim() !== version || !section[2]?.trim()) {
    throw new Error(`First changelog section must contain notes for ${version}`)
  }
  return section[2].trim()
}

export function compareVersions(a: string, b: string) {
  if (!(versionPattern.test(a) && versionPattern.test(b))) {
    throw new Error(`Cannot compare release versions ${a} and ${b}`)
  }
  const left = a.split('.').map(Number)
  const right = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const difference = (left[i] ?? 0) - (right[i] ?? 0)
    if (difference !== 0) return Math.sign(difference)
  }
  return 0
}

export function rejectDowngrade(current: string, candidate: string, name: string) {
  if (compareVersions(current, candidate) > 0) {
    throw new Error(`Refusing to downgrade ${name} from ${current} to ${candidate}`)
  }
}

// A channel upload can stop between per-target manifest replacements. Every surviving
// manifest is authoritative for its referenced archive until the retry finishes.
export async function previousChannelArchives(
  directory: string,
  candidateVersion: string,
  channelBaseUrl: string,
) {
  const archives = new Set<string>()
  for (const file of await readdir(directory)) {
    if (!manifestPattern.test(file)) continue
    const manifest = JSON.parse(await readFile(path.join(directory, file), 'utf8')) as {
      version?: unknown
      assetUrl?: unknown
    }
    if (typeof manifest.version !== 'string') throw new Error(`Invalid version in ${file}`)
    rejectDowngrade(manifest.version, candidateVersion, channelBaseUrl)
    if (
      typeof manifest.assetUrl !== 'string' ||
      !manifest.assetUrl.startsWith(`${channelBaseUrl}/`)
    ) {
      throw new Error(`Invalid channel asset URL in ${file}`)
    }
    const url = new URL(manifest.assetUrl)
    const archive = path.basename(url.pathname)
    if (manifest.assetUrl !== `${channelBaseUrl}/${archive}` || !archivePattern.test(archive)) {
      throw new Error(`Invalid channel asset URL in ${file}`)
    }
    archives.add(archive)
  }
  return archives
}

export function requireSameReleaseCommit(targetCommitish: string, commit: string) {
  if (targetCommitish !== commit) {
    throw new Error(`Release belongs to ${targetCommitish}, not ${commit}`)
  }
}

export async function copyReleaseAssets(source: string, destination: string) {
  await mkdir(destination, { recursive: true })
  const queue = [source]
  const names = new Set<string>()
  while (queue.length > 0) {
    const directory = queue.pop()
    if (!directory) continue
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name)
      if (entry.isDirectory()) queue.push(file)
      else if (entry.isFile()) {
        if (names.has(entry.name)) throw new Error(`Duplicate release asset ${entry.name}`)
        names.add(entry.name)
        await copyFile(file, path.join(destination, entry.name))
      }
    }
  }
  return [...names].sort()
}

export async function rewriteManifestUrls(directory: string, fromBase: string, toBase: string) {
  for (const file of await readdir(directory)) {
    if (!manifestPattern.test(file)) continue
    const location = path.join(directory, file)
    const manifest = JSON.parse(await readFile(location, 'utf8')) as { assetUrl?: unknown }
    if (typeof manifest.assetUrl !== 'string' || !manifest.assetUrl.startsWith(`${fromBase}/`)) {
      throw new Error(`${file} does not point beneath ${fromBase}`)
    }
    manifest.assetUrl = `${toBase}${manifest.assetUrl.slice(fromBase.length)}`
    await writeFile(location, JSON.stringify(manifest))
  }
}
