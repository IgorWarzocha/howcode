import { existsSync } from 'node:fs'
import { chmod, mkdir, readFile, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import { extractUpdateArchive } from './update-archive'
import { withUpdateLock } from './update-lock'
import {
  getAppResourcesPath,
  type getInstallPaths,
  hasPackagedAppBundle,
  type InstalledUpdate,
  isValidInstall,
  parseInstalledUpdateRecord,
  pruneOldVersions,
  type ReleaseInfo,
  type UpdateTarget,
} from './update-storage'
import { downloadFile, isExecutableFile, sha256File, writeAtomicJson } from './update-transport'

function getMissingPackagedBundleMessage(installDir: string, target: UpdateTarget) {
  const resourcesPath = getAppResourcesPath(installDir, target)
  return [
    'Downloaded archive did not contain the packaged app bundle.',
    `Checked ${path.join(resourcesPath, 'app.asar')} and ${path.join(resourcesPath, 'app', 'package.json')}.`,
  ].join(' ')
}

async function readCurrentFile(currentFile: string) {
  try {
    return parseInstalledUpdateRecord(JSON.parse(await readFile(currentFile, 'utf8')))
  } catch {
    return null
  }
}

type InstallInput = {
  release: ReleaseInfo
  target: UpdateTarget
  paths: ReturnType<typeof getInstallPaths>
  getKeepDirs: (installDir: string) => Promise<ReadonlySet<string>>
  onInstalling: () => void
}

type TemporaryInstallPaths = {
  root: string | null
  installDir: string | null
}

export async function installUpdateBundle(input: InstallInput) {
  const temporaryPaths: TemporaryInstallPaths = { root: null, installDir: null }
  try {
    return await withUpdateLock(input.paths.cacheRoot, () =>
      installUpdateBundleUnderLock(input, temporaryPaths),
    )
  } finally {
    await Promise.all([
      temporaryPaths.root
        ? rm(temporaryPaths.root, { recursive: true, force: true })
        : Promise.resolve(),
      temporaryPaths.installDir
        ? rm(temporaryPaths.installDir, { recursive: true, force: true })
        : Promise.resolve(),
    ]).catch(() => undefined)
  }
}

async function installUpdateBundleUnderLock(
  input: InstallInput,
  temporaryPaths: TemporaryInstallPaths,
) {
  const { release, target, paths, getKeepDirs, onInstalling } = input
  const currentRecord = await readCurrentFile(paths.currentFile)
  const existingCacheTrusted =
    currentRecord?.version === release.version &&
    currentRecord.hash === release.hash &&
    currentRecord.installDir === paths.installDir &&
    currentRecord.executablePath === paths.executablePath &&
    (await isValidInstall(paths, target))
  if (!existingCacheTrusted) {
    temporaryPaths.root = path.join(paths.cacheRoot, `.tmp-update-${Date.now()}-${process.pid}`)
    temporaryPaths.installDir = `${paths.installDir}.partial`
    const archivePath = path.join(temporaryPaths.root, `howcode-${target.os}-${target.arch}.tar.gz`)
    await rm(temporaryPaths.root, { recursive: true, force: true })
    await rm(temporaryPaths.installDir, { recursive: true, force: true })
    await mkdir(temporaryPaths.root, { recursive: true })
    await downloadFile(release.assetUrl, archivePath)
    const hash = await sha256File(archivePath)
    if (hash !== release.hash) {
      throw new Error(`Downloaded archive hash mismatch. Expected ${release.hash}, got ${hash}.`)
    }
    onInstalling()
    await mkdir(temporaryPaths.installDir, { recursive: true })
    await extractUpdateArchive(archivePath, temporaryPaths.installDir)
    const extractedExecutablePath = path.join(temporaryPaths.installDir, target.executable)
    if (!existsSync(extractedExecutablePath)) {
      throw new Error(`Downloaded archive did not contain ${target.executable}.`)
    }
    if (process.platform !== 'win32') await chmod(extractedExecutablePath, 0o755)
    if (!(await isExecutableFile(extractedExecutablePath))) {
      throw new Error(`Downloaded archive did not contain ${target.executable}.`)
    }
    if (!hasPackagedAppBundle(temporaryPaths.installDir, target)) {
      throw new Error(getMissingPackagedBundleMessage(temporaryPaths.installDir, target))
    }
    await rm(paths.installDir, { recursive: true, force: true })
    await mkdir(path.dirname(paths.installDir), { recursive: true })
    await rename(temporaryPaths.installDir, paths.installDir)
    temporaryPaths.installDir = null
    await rm(temporaryPaths.root, { recursive: true, force: true })
    temporaryPaths.root = null
  }

  const installedUpdate: InstalledUpdate = {
    ...release,
    executablePath: paths.executablePath,
    installDir: paths.installDir,
  }
  await writeAtomicJson(paths.currentFile, installedUpdate)
  const keepDirs = await getKeepDirs(paths.installDir)
  const pruneFailures = await pruneOldVersions(paths.cacheRoot, keepDirs)
  return { installedUpdate, pruneFailures }
}
