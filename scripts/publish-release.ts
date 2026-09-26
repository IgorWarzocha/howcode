import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { validateReleaseAssets } from './release-assets-validation'
import {
  channelRetention,
  copyReleaseAssets,
  newestChannelRetention,
  parseChannelRetention,
  previousChannelArchives,
  rejectDowngrade,
  releaseNotes,
  requireSameReleaseCommit,
  rewriteManifestUrls,
} from './release-publication-policy'

type Release = {
  isDraft: boolean
  targetCommitish: string
  assets: { name: string; state: 'uploaded' | 'starter' }[]
}
// biome-ignore lint/complexity/useLiteralKeys: ProcessEnv is an index-signature type.
const releaseRepository = process.env['GITHUB_REPOSITORY']
// biome-ignore lint/complexity/useLiteralKeys: ProcessEnv is an index-signature type.
const releaseCommit = process.env['GITHUB_SHA']
// biome-ignore lint/complexity/useLiteralKeys: ProcessEnv is an index-signature type.
const releaseRefName = process.env['GITHUB_REF_NAME']
const versionTagPattern = /^v\d+\.\d+\.\d+$/
const manifestPattern = /^stable-.*-update\.json$/
const retentionAssetPattern = /^channel-archive-retention-\d+-(?:pending|complete)\.json$/
const managedAssetPattern =
  /^(stable-.*-update\.json|(?:archive-)?howcode-.*\.tar\.gz|.*\.(?:AppImage|exe|zip))$/

function gh(...args: string[]) {
  const result = Bun.spawnSync(['gh', ...args], { stdout: 'pipe', stderr: 'pipe' })
  if (result.exitCode !== 0) {
    throw new Error(`gh ${args.join(' ')} failed: ${result.stderr.toString()}`)
  }
  return result.stdout.toString().trim()
}

function release(tag: string): Release | undefined {
  const result = Bun.spawnSync(
    ['gh', 'release', 'view', tag, '--json', 'isDraft,targetCommitish,assets'],
    { stdout: 'pipe', stderr: 'pipe' },
  )
  if (result.exitCode !== 0) {
    const error = result.stderr.toString()
    if (error.includes('release not found') || error.includes('HTTP 404')) return undefined
    throw new Error(`Cannot inspect release ${tag}: ${error}`)
  }
  const snapshot = JSON.parse(result.stdout.toString()) as Release
  if (
    !Array.isArray(snapshot.assets) ||
    snapshot.assets.some((asset) => asset.state !== 'uploaded' && asset.state !== 'starter')
  ) {
    throw new Error(`Release ${tag} has an unknown asset state`)
  }
  return snapshot
}

function checkVersionTagCommit(tag: string, commit: string) {
  const result = Bun.spawnSync(
    ['git', 'ls-remote', 'origin', `refs/tags/${tag}`, `refs/tags/${tag}^{}`],
    {
      stdout: 'pipe',
      stderr: 'pipe',
    },
  )
  if (result.exitCode !== 0) throw new Error(`Cannot inspect ${tag}: ${result.stderr.toString()}`)
  const refs = result.stdout.toString().trim().split('\n').filter(Boolean)
  const dereferenced = refs.find((ref) => ref.endsWith(`refs/tags/${tag}^{}`))
  const resolved = (dereferenced ?? refs[0])?.split('\t')[0]
  if (resolved) requireSameReleaseCommit(resolved, commit)
}

function latestVersion(repository: string) {
  const response = Bun.spawnSync(['gh', 'api', `repos/${repository}/releases/latest`], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (response.exitCode !== 0) {
    if (response.stderr.toString().includes('HTTP 404')) return undefined
    throw new Error(`Could not inspect latest release: ${response.stderr.toString()}`)
  }
  const tag = (JSON.parse(response.stdout.toString()) as { tag_name: string }).tag_name
  return versionTagPattern.test(tag) ? tag.slice(1) : undefined
}

async function rejectChannelDowngrade(tag: string, version: string) {
  const old = release(tag)
  if (!old) return
  const previous = await mkdtemp(path.join(tmpdir(), 'howcode-previous-channel-'))
  try {
    downloadChannelManifests(tag, old, previous)
    await previousChannelArchives(previous, version, baseUrl(tag))
  } finally {
    await rm(previous, { recursive: true, force: true })
  }
}

async function upload(tag: string, directory: string, names: string[], clobber = false) {
  if (names.length > 0)
    gh(
      'release',
      'upload',
      tag,
      ...names.map((name) => path.join(directory, name)),
      ...(clobber ? ['--clobber'] : []),
    )
}

async function publishCanonical(
  tag: string,
  commit: string,
  directory: string,
  names: string[],
  title: string,
  notes: string,
) {
  let existing = release(tag)
  if (existing) requireSameReleaseCommit(existing.targetCommitish, commit)
  if (!existing) {
    gh(
      'release',
      'create',
      tag,
      '--draft',
      '--latest=false',
      '--target',
      commit,
      '--title',
      title,
      '--notes',
      notes,
    )
    existing = release(tag)
    if (!existing) throw new Error(`Cannot inspect new draft ${tag}`)
  }
  if (existing.isDraft) await completeDraft(tag, directory, names, existing.assets)
}

async function completeDraft(
  tag: string,
  directory: string,
  names: string[],
  assets: Release['assets'],
) {
  // A same-commit rebuild can have different archive bytes. Only drafts may be refreshed.
  await upload(
    tag,
    directory,
    names.filter((name) => !name.endsWith('-update.json')),
    true,
  )
  await upload(
    tag,
    directory,
    names.filter((name) => name.endsWith('-update.json')),
    true,
  )
  for (const asset of assets) {
    if (!names.includes(asset.name)) gh('release', 'delete-asset', tag, asset.name, '--yes')
  }
}

function downloadChannelManifests(tag: string, old: Release, directory: string) {
  // A draft may have no manifests, or a failed upload may have left a starter.
  for (const asset of old.assets) {
    if (asset.state === 'uploaded' && manifestPattern.test(asset.name)) {
      gh('release', 'download', tag, '--pattern', asset.name, '--dir', directory)
    }
  }
}

function removeChannelStarters(tag: string, old: Release | undefined) {
  if (!old) return undefined
  // GitHub can leave zero-byte starter assets after an interrupted upload.
  const starters = old.assets.filter(
    (asset) =>
      asset.state === 'starter' &&
      (managedAssetPattern.test(asset.name) || retentionAssetPattern.test(asset.name)),
  )
  for (const asset of starters) gh('release', 'delete-asset', tag, asset.name, '--yes')
  if (starters.length === 0) return old
  const refreshed = release(tag)
  if (!refreshed) throw new Error(`Cannot inspect channel release ${tag} after starter cleanup`)
  return refreshed
}

async function prepareChannelRetention(
  tag: string,
  old: Release | undefined,
  directory: string,
  version: string,
  commit: string,
  names: string[],
  retain: Set<string>,
) {
  const records: ReturnType<typeof parseChannelRetention>[] = []
  if (old) {
    downloadChannelManifests(tag, old, directory)
    for (const asset of old.assets) {
      if (asset.state !== 'uploaded' || !retentionAssetPattern.test(asset.name)) continue
      gh('release', 'download', tag, '--pattern', asset.name, '--dir', directory)
      records.push(
        parseChannelRetention(JSON.parse(await readFile(path.join(directory, asset.name), 'utf8'))),
      )
    }
  }
  const advertised = await previousChannelArchives(directory, version, baseUrl(tag))
  const candidate = new Set(names.filter((name) => name.startsWith('archive-howcode-')))
  const record = channelRetention(commit, advertised, candidate, newestChannelRetention(records))
  for (const archive of record.previous) {
    if (old?.assets.some((asset) => asset.name === archive)) retain.add(archive)
  }
  // Record the pre-update generation before any advertised manifest is replaced.
  const pendingMarker = `channel-archive-retention-${record.revision}-pending.json`
  const recordFile = path.join(directory, pendingMarker)
  await writeFile(recordFile, JSON.stringify(record))
  await upload(tag, directory, [pendingMarker])
  return { record, pendingMarker }
}

async function publishChannel(
  channel: 'main' | 'dev',
  commit: string,
  directory: string,
  names: string[],
  version: string,
  notes: string,
) {
  const tag = `channel-${channel}`
  const prereleaseFlags = channel === 'dev' ? ['--prerelease'] : []
  const old = removeChannelStarters(tag, release(tag))
  const previous = await mkdtemp(path.join(tmpdir(), 'howcode-channel-'))
  const retain = new Set(names)
  try {
    if (!old) {
      gh(
        'release',
        'create',
        tag,
        '--draft',
        '--latest=false',
        ...prereleaseFlags,
        '--target',
        commit,
        '--title',
        `howcode ${channel} (${version})`,
        '--notes',
        notes,
      )
    }
    const { record, pendingMarker } = await prepareChannelRetention(
      tag,
      old,
      previous,
      version,
      commit,
      names,
      retain,
    )
    await upload(
      tag,
      directory,
      names.filter((name) => !name.endsWith('-update.json')),
      true,
    )
    // Advertise archives only after their uploads have succeeded.
    await upload(
      tag,
      directory,
      names.filter((name) => name.endsWith('-update.json')),
      true,
    )
    const title = channel === 'dev' ? `howcode dev (${version})` : `howcode ${version}`
    gh(
      'release',
      'edit',
      tag,
      '--draft=false',
      '--latest=false',
      ...prereleaseFlags,
      '--target',
      commit,
      '--title',
      title,
      '--notes',
      `## ${title}\n\n${notes}\n\n### Release channel\n\nThis is the moving ${channel === 'dev' ? 'dev' : 'stable'} channel used by \`npx howcode${channel === 'dev' ? '@dev' : ''}\`. Future app updates refresh these GitHub Release assets without requiring an npm package publish unless the launcher itself changes.\n`,
    )
    const updated = release(tag)
    if (!updated) throw new Error(`Cannot inspect channel release ${tag} after upload`)
    for (const asset of updated.assets) {
      if (!retain.has(asset.name) && managedAssetPattern.test(asset.name)) {
        gh('release', 'delete-asset', tag, asset.name, '--yes')
      }
    }
    // Publish completion separately; a failed upload must not erase the pending record.
    const completeMarker = `channel-archive-retention-${record.revision}-complete.json`
    await writeFile(
      path.join(previous, completeMarker),
      JSON.stringify({ ...record, complete: true }),
    )
    await upload(tag, previous, [completeMarker])
    for (const asset of old?.assets ?? []) {
      if (retentionAssetPattern.test(asset.name))
        gh('release', 'delete-asset', tag, asset.name, '--yes')
    }
    gh('release', 'delete-asset', tag, pendingMarker, '--yes')
  } finally {
    await rm(previous, { recursive: true, force: true })
  }
}

function baseUrl(tag: string) {
  return `https://github.com/${releaseRepository}/releases/download/${tag}`
}

async function publishStable(
  mode: string,
  repository: string,
  commit: string,
  version: string,
  notes: string,
  directory: string,
  names: string[],
) {
  const tag = `v${version}`
  checkVersionTagCommit(tag, commit)
  const latest = latestVersion(repository)
  if (mode === 'main' && latest) rejectDowngrade(latest, version, 'latest')
  if (mode === 'main') await rejectChannelDowngrade('channel-main', version)
  const canonical = await mkdtemp(path.join(tmpdir(), 'howcode-canonical-'))
  try {
    if (mode === 'main') await rewriteManifestUrls(directory, baseUrl('channel-main'), baseUrl(tag))
    await validateReleaseAssets(directory, 'main', version, baseUrl(tag))
    await publishCanonical(tag, commit, directory, names, `howcode ${version}`, notes)
    if (release(tag)?.isDraft) {
      gh('release', 'edit', tag, '--draft=false', mode === 'main' ? '--latest' : '--latest=false')
    } else if (mode === 'main' && latest !== version) {
      gh('release', 'edit', tag, '--latest')
    }
    // The published canonical assets, not a potentially different rebuild, feed channel retries.
    gh('release', 'download', tag, '--dir', canonical)
    await validateReleaseAssets(canonical, 'main', version, baseUrl(tag))
    if (mode === 'main') {
      await rewriteManifestUrls(canonical, baseUrl(tag), baseUrl('channel-main'))
      await validateReleaseAssets(canonical, 'main', version, baseUrl('channel-main'))
      await publishChannel('main', commit, canonical, await readdir(canonical), version, notes)
    }
  } finally {
    await rm(canonical, { recursive: true, force: true })
  }
}

async function main() {
  const mode = process.argv[2]
  const source = process.argv[3]
  const commit = releaseCommit
  const repository = releaseRepository
  if (!(source && commit && repository && ['main', 'dev', 'tag'].includes(mode ?? ''))) {
    throw new Error(
      'Usage: bun scripts/publish-release.ts <main|dev|tag> <release-assets>; requires GITHUB_SHA and GITHUB_REPOSITORY',
    )
  }
  const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as { version?: unknown }
  if (typeof packageJson.version !== 'string') throw new Error('Missing app version')
  const version = packageJson.version
  const notes = releaseNotes(await readFile('docs/changelog.md', 'utf8'), version)
  const tag = `v${version}`
  if (mode === 'tag' && releaseRefName !== tag) {
    throw new Error(`Tag ${releaseRefName} does not match app version ${tag}`)
  }

  const directory = await mkdtemp(path.join(tmpdir(), 'howcode-release-'))
  try {
    const names = await copyReleaseAssets(source, directory)
    const channel = mode === 'dev' ? 'dev' : 'main'
    await validateReleaseAssets(
      directory,
      channel,
      version,
      baseUrl(mode === 'tag' ? tag : `channel-${channel}`),
    )
    if (mode === 'dev') {
      await publishChannel('dev', commit, directory, names, version, notes)
    } else {
      await publishStable(mode ?? '', repository, commit, version, notes, directory, names)
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

await main()
