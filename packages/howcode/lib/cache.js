const fs = require('node:fs')
const fsp = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { APP_NAME, CHANNEL_RELEASE_TAGS } = require('./config')

function getCacheRoot() {
  if (process.env.HOWCODE_CACHE_DIR) return process.env.HOWCODE_CACHE_DIR
  if (process.platform === 'win32') {
    return path.join(
      process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
      APP_NAME,
    )
  }
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Caches', APP_NAME)
  return path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), APP_NAME)
}

function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

function getPaths(target, releaseInfo) {
  const cacheRoot = getCacheRoot()
  const installDir = path.join(
    cacheRoot,
    'versions',
    `${releaseInfo.channel}-${releaseInfo.version}-${releaseInfo.hash}`,
  )
  return {
    cacheRoot,
    currentFile: path.join(cacheRoot, `current-${releaseInfo.channel}.json`),
    windowsCommandFile: path.join(cacheRoot, `${APP_NAME}.cmd`),
    launcherWorkingDirectory: path.dirname(path.join(installDir, target.executable)),
    installDir,
    executablePath: path.join(installDir, target.executable),
  }
}

function getAppResourcesPath(installDir, target) {
  if (target.os === 'macos')
    return path.join(installDir, `${APP_NAME}.app`, 'Contents', 'Resources')
  return path.join(installDir, APP_NAME, 'resources')
}

function hasPackagedAppBundle(installDir, target) {
  const resourcesPath = getAppResourcesPath(installDir, target)
  return (
    fs.existsSync(path.join(resourcesPath, 'app.asar')) ||
    fs.existsSync(path.join(resourcesPath, 'app', 'package.json'))
  )
}

function isLaunchableFile(filePath) {
  try {
    const executable = fs.statSync(filePath)
    if (!executable.isFile()) return false
    if (process.platform !== 'win32') fs.accessSync(filePath, fs.constants.X_OK)
    return true
  } catch {
    return false
  }
}

function isValidInstall(paths, target) {
  return isLaunchableFile(paths.executablePath) && hasPackagedAppBundle(paths.installDir, target)
}

async function withUpdateLock(cacheRoot, operation) {
  const lockPath = path.join(cacheRoot, '.update.lock')
  await fsp.mkdir(cacheRoot, { recursive: true })
  let acquired = false
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      await fsp.mkdir(lockPath)
      acquired = true
      break
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error
      try {
        const ageMs = Date.now() - (await fsp.stat(lockPath)).mtimeMs
        if (ageMs > 15 * 60_000) await fsp.rm(lockPath, { recursive: true, force: true })
      } catch {
        // Another launcher may have released the lock between stat and cleanup.
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
  if (!acquired) throw new Error('Another Howcode update is still running. Try again shortly.')
  try {
    return await operation()
  } finally {
    await fsp.rm(lockPath, { recursive: true, force: true }).catch(() => undefined)
  }
}

async function writeCurrentFile(currentFile, record) {
  const temporaryFile = `${currentFile}.tmp-${process.pid}-${Date.now()}`
  await fsp.mkdir(path.dirname(currentFile), { recursive: true })
  try {
    await fsp.writeFile(temporaryFile, JSON.stringify(record, null, 2))
    await fsp.rename(temporaryFile, currentFile)
  } catch (error) {
    await fsp.rm(temporaryFile, { force: true }).catch(() => undefined)
    throw error
  }
}

async function getPruneKeepDirs(cacheRoot, keepDir) {
  const keepDirs = new Set([keepDir])
  for (const channel of Object.keys(CHANNEL_RELEASE_TAGS)) {
    const record = readJsonIfPresent(path.join(cacheRoot, `current-${channel}.json`))
    if (record?.installDir) keepDirs.add(record.installDir)
  }
  return keepDirs
}

async function pruneOldVersions(cacheRoot, keepDir, recentlyReplacedDir = null) {
  const versionsRoot = path.join(cacheRoot, 'versions')
  const keepDirs = await getPruneKeepDirs(cacheRoot, keepDir)
  if (recentlyReplacedDir) keepDirs.add(recentlyReplacedDir)
  let entries = []
  try {
    entries = await fsp.readdir(versionsRoot, { withFileTypes: true })
  } catch {
    return
  }
  await Promise.all(
    entries.flatMap((entry) => {
      if (!entry.isDirectory()) return []
      const dirPath = path.join(versionsRoot, entry.name)
      return keepDirs.has(dirPath) ? [] : [fsp.rm(dirPath, { recursive: true, force: true })]
    }),
  )
}

module.exports = {
  getCacheRoot,
  getPaths,
  hasPackagedAppBundle,
  isValidInstall,
  isLaunchableFile,
  pruneOldVersions,
  readJsonIfPresent,
  withUpdateLock,
  writeCurrentFile,
}
