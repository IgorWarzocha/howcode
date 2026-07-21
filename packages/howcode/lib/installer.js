const fsp = require('node:fs/promises')
const fs = require('node:fs')
const path = require('node:path')
const tar = require('tar')
const { APP_NAME } = require('./config')
const {
  hasPackagedAppBundle,
  isValidInstall,
  readJsonIfPresent,
  withUpdateLock,
  writeCurrentFile,
} = require('./cache')
const { downloadFile, sha256File } = require('./download')

async function installRelease(target, releaseInfo, paths) {
  const tempRoot = path.join(paths.cacheRoot, `.tmp-${Date.now()}-${process.pid}`)
  const tempInstallDir = `${paths.installDir}.partial`
  const archivePath = path.join(tempRoot, `${APP_NAME}-${target.os}-${target.arch}.tar.gz`)
  console.log(`Downloading ${APP_NAME} ${releaseInfo.version} for ${target.os}-${target.arch}...`)

  await fsp.rm(tempRoot, { recursive: true, force: true })
  await fsp.rm(tempInstallDir, { recursive: true, force: true })
  await fsp.mkdir(tempRoot, { recursive: true })
  await fsp.mkdir(path.dirname(paths.installDir), { recursive: true })
  try {
    await downloadFile(releaseInfo.assetUrl, archivePath)
    const archiveHash = await sha256File(archivePath)
    if (archiveHash !== releaseInfo.hash) {
      throw new Error(
        `Downloaded archive hash mismatch. Expected ${releaseInfo.hash}, got ${archiveHash}.`,
      )
    }
    await fsp.mkdir(tempInstallDir, { recursive: true })
    await tar.x({ file: archivePath, cwd: tempInstallDir })
    const extractedExecutablePath = path.join(tempInstallDir, target.executable)
    if (!fs.existsSync(extractedExecutablePath)) {
      throw new Error(`Downloaded archive did not contain ${target.executable}.`)
    }
    if (process.platform !== 'win32') await fsp.chmod(extractedExecutablePath, 0o755)
    if (
      !isValidInstall(
        { installDir: tempInstallDir, executablePath: extractedExecutablePath },
        target,
      )
    ) {
      throw new Error(`Downloaded archive did not contain a launchable ${target.executable}.`)
    }
    if (!hasPackagedAppBundle(tempInstallDir, target)) {
      throw new Error('Downloaded archive did not contain the packaged app bundle.')
    }
    await fsp.rm(paths.installDir, { recursive: true, force: true })
    await fsp.rename(tempInstallDir, paths.installDir)
    await writeCurrentFile(paths.currentFile, {
      version: releaseInfo.version,
      channel: releaseInfo.channel,
      hash: releaseInfo.hash,
      installDir: paths.installDir,
      executablePath: paths.executablePath,
    })
  } finally {
    await Promise.all([
      fsp.rm(tempRoot, { recursive: true, force: true }),
      fsp.rm(tempInstallDir, { recursive: true, force: true }),
    ]).catch(() => undefined)
  }
}

async function ensureInstalled(target, releaseInfo, paths) {
  let didInstall = false
  let recentlyReplacedDir = null
  await withUpdateLock(paths.cacheRoot, async () => {
    recentlyReplacedDir = readJsonIfPresent(paths.currentFile)?.installDir || null
    if (!recentlyReplacedDir && releaseInfo.channel === 'main') {
      recentlyReplacedDir =
        readJsonIfPresent(path.join(paths.cacheRoot, 'current.json'))?.installDir || null
    }
    didInstall = !isValidInstall(paths, target)
    if (didInstall) await installRelease(target, releaseInfo, paths)
  })
  return { didInstall, recentlyReplacedDir }
}

module.exports = { ensureInstalled }
