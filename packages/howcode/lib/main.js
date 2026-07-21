const path = require('node:path')
const fsp = require('node:fs/promises')
const { getReleaseChannel, getTarget } = require('./config')
const { getCacheRoot, getPaths, isValidInstall, readJsonIfPresent } = require('./cache')
const { ensureCommandLaunchIntegration } = require('./integration')
const { resolveLatestRelease } = require('./release')
const { ensureInstalled } = require('./installer')
const { launch } = require('./process-launcher')

async function main() {
  const launchArgs = process.argv.slice(2)
  const target = getTarget()
  const cacheRoot = getCacheRoot()
  const channel = getReleaseChannel()
  await fsp.mkdir(cacheRoot, { recursive: true })

  const currentFile = path.join(cacheRoot, `current-${channel}.json`)
  const current =
    readJsonIfPresent(currentFile) ||
    (channel === 'main' ? readJsonIfPresent(path.join(cacheRoot, 'current.json')) : null)

  let releaseInfo = null
  try {
    releaseInfo = await resolveLatestRelease(target)
  } catch (error) {
    if (current?.executablePath) {
      const currentPaths = {
        cacheRoot,
        currentFile,
        windowsCommandFile: path.join(cacheRoot, 'howcode.cmd'),
        installDir: current.installDir || path.dirname(path.dirname(current.executablePath)),
        launcherWorkingDirectory: path.dirname(current.executablePath),
        executablePath: current.executablePath,
      }
      if (!isValidInstall(currentPaths, target)) throw error
      await ensureCommandLaunchIntegration(target, currentPaths)
      await launch(current.executablePath, launchArgs, { cacheRoot })
      return
    }
    throw error
  }

  const paths = getPaths(target, releaseInfo)
  const { didInstall, pruneFailures } = await ensureInstalled(target, releaseInfo, paths)
  const launchIntegrationReady = await ensureCommandLaunchIntegration(target, paths)
  if (target.os === 'win' && didInstall && launchIntegrationReady) {
    console.log('howcode: installed. You can relaunch it from the Windows Start Menu.')
  }
  if (pruneFailures.length > 0) {
    console.warn(`howcode: could not remove ${pruneFailures.length} old cached version(s).`)
  }
  await launch(paths.executablePath, launchArgs, { cacheRoot })
}

module.exports = { main }
