import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { isUpdateCandidate, type UpdateChannel } from './update-protocol'
import {
  getCacheRoot,
  getInstallPaths,
  getLegacyInstallPaths,
  getRunningReleaseFingerprint,
  type InstalledUpdate,
  isValidInstall,
  parseInstalledUpdateRecord,
  type UpdateTarget,
} from './update-storage'
import { writeAtomicJson } from './update-transport'

async function readCurrentFile(currentFile: string, fallbackChannel: UpdateChannel | null = null) {
  try {
    return parseInstalledUpdateRecord(
      JSON.parse(await readFile(currentFile, 'utf8')),
      fallbackChannel,
    )
  } catch {
    return null
  }
}

export async function findRestorableUpdate(input: {
  channel: UpdateChannel
  currentVersion: string
  target: UpdateTarget
}): Promise<InstalledUpdate | null> {
  const cacheRoot = getCacheRoot()
  const currentFile = path.join(cacheRoot, `current-${input.channel}.json`)
  const record =
    (await readCurrentFile(currentFile)) ??
    (input.channel === 'main'
      ? await readCurrentFile(path.join(cacheRoot, 'current.json'), 'main')
      : null)
  if (
    !(record && isUpdateCandidate(input.currentVersion, record, getRunningReleaseFingerprint()))
  ) {
    return null
  }

  const expectedPaths = getInstallPaths(input.target, record)
  const legacyPaths = getLegacyInstallPaths(input.target, record)
  const usesLegacyPaths =
    record.installDir === legacyPaths.installDir &&
    record.executablePath === legacyPaths.executablePath
  const paths = usesLegacyPaths ? legacyPaths : expectedPaths
  if (record.installDir !== paths.installDir || record.executablePath !== paths.executablePath) {
    return null
  }
  if (!(await isValidInstall(paths, input.target))) return null
  if (usesLegacyPaths) await writeAtomicJson(currentFile, record).catch(() => undefined)
  return record
}

export async function getUpdatePruneKeepDirs(installDir: string) {
  const cacheRoot = getCacheRoot()
  const keepDirs = new Set([installDir])
  await Promise.all(
    (['main', 'dev'] as const).map(async (channel) => {
      const record = await readCurrentFile(path.join(cacheRoot, `current-${channel}.json`))
      if (record?.installDir) keepDirs.add(record.installDir)
    }),
  )
  const legacyRecord = await readCurrentFile(path.join(cacheRoot, 'current.json'), 'main')
  if (legacyRecord?.installDir) keepDirs.add(legacyRecord.installDir)
  return keepDirs
}
