const fs = require('node:fs')
const fsp = require('node:fs/promises')
const crypto = require('node:crypto')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const { pipeline } = require('node:stream/promises')
const { Readable, Transform } = require('node:stream')
const tar = require('tar')

const packageJson = require('../package.json')

const APP_NAME = packageJson.howcode.appName
const RELEASE_BASE_URL = process.env.HOWCODE_BASE_URL || packageJson.howcode.releaseBaseUrl
const RELEASE_CHANNEL =
  process.env.HOWCODE_RELEASE_CHANNEL || packageJson.howcode.releaseChannel || 'main'
const CHANNEL_RELEASE_TAGS = { main: 'channel-main', dev: 'channel-dev' }
const trailingSlashesPattern = /\/+$/
const trailingChannelPattern = /\/(?:main|dev|channel-main|channel-dev)$/i
const releaseTagPlaceholderPattern = /\{releaseTag\}/g
const channelPlaceholderPattern = /\{channel\}/g
const FETCH_METADATA_TIMEOUT_MS = 30_000
const DOWNLOAD_IDLE_TIMEOUT_MS = 60_000
const UPDATE_PROTOCOL_VERSION = 2
const semverPattern = /^\d+\.\d+\.\d+$/
const sha256Pattern = /^[a-f0-9]{64}$/i

const TARGETS = {
  'darwin:arm64': {
    os: 'macos',
    arch: 'arm64',
    executable: `${APP_NAME}.app/Contents/MacOS/${APP_NAME}`,
  },
  'darwin:x64': {
    os: 'macos',
    arch: 'x64',
    executable: `${APP_NAME}.app/Contents/MacOS/${APP_NAME}`,
  },
  'linux:arm64': {
    os: 'linux',
    arch: 'arm64',
    executable: `${APP_NAME}/${APP_NAME}`,
  },
  'linux:x64': {
    os: 'linux',
    arch: 'x64',
    executable: `${APP_NAME}/${APP_NAME}`,
  },
  'win32:arm64': {
    os: 'win',
    arch: 'arm64',
    executable: `${APP_NAME}/${APP_NAME}.exe`,
  },
  'win32:x64': {
    os: 'win',
    arch: 'x64',
    executable: `${APP_NAME}/${APP_NAME}.exe`,
  },
}

function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

function getTarget() {
  const key = `${process.platform}:${process.arch}`
  const target = TARGETS[key]
  if (!target) {
    throw new Error(`Unsupported platform: ${process.platform} ${process.arch}`)
  }
  return target
}

function getCacheRoot() {
  if (process.env.HOWCODE_CACHE_DIR) {
    return process.env.HOWCODE_CACHE_DIR
  }

  if (process.platform === 'win32') {
    return path.join(
      process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
      APP_NAME,
    )
  }

  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Caches', APP_NAME)
  }

  return path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), APP_NAME)
}

function getReleaseChannel() {
  if (RELEASE_CHANNEL === 'main' || RELEASE_CHANNEL === 'dev') return RELEASE_CHANNEL
  throw new Error(`Unsupported release channel: ${RELEASE_CHANNEL}`)
}

function getChannelReleaseTag(channel) {
  return CHANNEL_RELEASE_TAGS[channel]
}

function getReleaseBaseUrl(channel = getReleaseChannel()) {
  const releaseTag = getChannelReleaseTag(channel)
  const baseUrl = RELEASE_BASE_URL.replace(trailingSlashesPattern, '')

  if (baseUrl.includes('{releaseTag}'))
    return baseUrl.replace(releaseTagPlaceholderPattern, releaseTag)
  if (baseUrl.includes('{channel}')) return baseUrl.replace(channelPlaceholderPattern, releaseTag)

  return baseUrl.replace(trailingChannelPattern, `/${releaseTag}`)
}

function addCacheBust(url) {
  const parsed = new URL(url)
  parsed.searchParams.set('cacheBust', `${Date.now()}-${Math.random().toString(36).slice(2)}`)
  return parsed.toString()
}

function validateReleaseMetadata(metadata, updateUrl, releaseBaseUrl, channel, fallbackAssetUrl) {
  if (!metadata || typeof metadata !== 'object') {
    throw new Error(`Invalid release metadata from ${updateUrl}`)
  }

  if (
    metadata.protocolVersion !== undefined &&
    (!Number.isInteger(metadata.protocolVersion) ||
      metadata.protocolVersion < 1 ||
      metadata.protocolVersion > UPDATE_PROTOCOL_VERSION)
  ) {
    throw new Error(`Unsupported update protocol from ${updateUrl}`)
  }
  if (metadata.channel !== undefined && metadata.channel !== channel) {
    throw new Error(`Release channel mismatch from ${updateUrl}`)
  }
  if (!(semverPattern.test(metadata.version) && sha256Pattern.test(metadata.hash))) {
    throw new Error(`Invalid release metadata from ${updateUrl}`)
  }

  const resolvedAssetUrl = new URL(metadata.assetUrl || fallbackAssetUrl, `${releaseBaseUrl}/`)
  const trustedReleaseBase = new URL(`${releaseBaseUrl}/`)
  const trustedPath = trustedReleaseBase.pathname.endsWith('/')
    ? trustedReleaseBase.pathname
    : `${trustedReleaseBase.pathname}/`
  if (
    resolvedAssetUrl.origin !== trustedReleaseBase.origin ||
    !resolvedAssetUrl.pathname.startsWith(trustedPath)
  ) {
    throw new Error(`Update metadata points to an untrusted asset URL: ${resolvedAssetUrl}`)
  }

  return {
    channel,
    version: metadata.version,
    hash: metadata.hash.toLowerCase(),
    assetUrl: resolvedAssetUrl.toString(),
  }
}

function getPaths(target, releaseInfo) {
  const cacheRoot = getCacheRoot()
  const versionsRoot = path.join(cacheRoot, 'versions')
  const releaseKey = `${releaseInfo.channel}-${releaseInfo.version}-${releaseInfo.hash}`
  const installDir = path.join(versionsRoot, releaseKey)
  const launcherWorkingDirectory = path.dirname(path.join(installDir, target.executable))
  return {
    cacheRoot,
    currentFile: path.join(cacheRoot, `current-${releaseInfo.channel}.json`),
    windowsCommandFile: path.join(cacheRoot, `${APP_NAME}.cmd`),
    launcherWorkingDirectory,
    installDir,
    executablePath: path.join(installDir, target.executable),
  }
}

function getAppResourcesPath(installDir, target) {
  if (target.os === 'macos') {
    return path.join(installDir, `${APP_NAME}.app`, 'Contents', 'Resources')
  }

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

function getLinuxCommandLauncherPath() {
  return path.join(process.env.XDG_BIN_HOME || path.join(os.homedir(), '.local', 'bin'), APP_NAME)
}

function shellSingleQuote(value) {
  return `'${value.replace(/'/g, `'"'"'`)}'`
}

function getLinuxSetsidPath() {
  for (const candidate of ['/usr/bin/setsid', '/bin/setsid']) {
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

function spawnLinuxDetachedLauncher(executablePath, args, env) {
  const setsidPath = getLinuxSetsidPath()
  if (setsidPath) {
    return spawn(setsidPath, ['-f', executablePath, ...args], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      cwd: path.dirname(executablePath),
      env,
    })
  }

  return spawn(
    '/bin/sh',
    [
      '-c',
      `nohup ${[executablePath, ...args].map(shellSingleQuote).join(' ')} >/dev/null 2>&1 </dev/null &`,
    ],
    {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      cwd: path.dirname(executablePath),
      env,
    },
  )
}

function isHeadlessLaunchArgs(args) {
  return args.includes('--headless') || process.env.HOWCODE_HEADLESS === '1'
}

function getAppLaunchArgs(args) {
  const appArgs = args.map((arg) => (arg === '--headless' ? '--howcode-headless' : arg))
  if (isHeadlessLaunchArgs(args) && !appArgs.some((arg) => arg.startsWith('--ozone-platform'))) {
    appArgs.push('--ozone-platform=headless')
  }
  return appArgs
}

async function writeLinuxCommandLauncher(paths) {
  const launcherPath = getLinuxCommandLauncherPath()
  const launcherDirectory = path.dirname(launcherPath)
  const shellParameterExpansionStart = '${'
  const launcherContents = [
    '#!/bin/sh',
    `export HOWCODE_REPO_ROOT=${shellParameterExpansionStart}HOWCODE_REPO_ROOT:-$(pwd)}`,
    'if [ "$1" = "--headless" ] || [ "$HOWCODE_HEADLESS" = "1" ]; then',
    '  if [ "$1" = "--headless" ]; then',
    '    shift',
    `    exec ${shellSingleQuote(paths.executablePath)} --howcode-headless --ozone-platform=headless "$@"`,
    '  fi',
    `  exec ${shellSingleQuote(paths.executablePath)} --ozone-platform=headless "$@"`,
    'fi',
    'if command -v setsid >/dev/null 2>&1; then',
    `  setsid -f ${shellSingleQuote(paths.executablePath)} "$@" >/dev/null 2>&1 </dev/null`,
    'else',
    `  nohup ${shellSingleQuote(paths.executablePath)} "$@" >/dev/null 2>&1 </dev/null &`,
    'fi',
    'exit 0',
    '',
  ].join('\n')

  await fsp.mkdir(launcherDirectory, { recursive: true })
  await fsp.writeFile(launcherPath, launcherContents, { encoding: 'utf8', mode: 0o755 })
  await fsp.chmod(launcherPath, 0o755)

  const pathEntries = (process.env.PATH || '').split(path.delimiter).filter(Boolean)
  if (!pathEntries.includes(launcherDirectory)) {
    console.warn(`${APP_NAME}: created ${launcherPath}, but ${launcherDirectory} is not in PATH.`)
    console.warn(`${APP_NAME}: add it to PATH or relaunch your shell before running ${APP_NAME}.`)
  }
}

async function ensureLinuxLaunchIntegration(target, paths) {
  if (target.os !== 'linux') {
    return true
  }

  try {
    await writeLinuxCommandLauncher(paths)
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`${APP_NAME}: could not create command launcher: ${message}`)
    return false
  }
}

function getWindowsStartMenuShortcutPath() {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
  return path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', `${APP_NAME}.lnk`)
}

function escapeWindowsCommandValue(value) {
  return value.replace(/%/g, '%%')
}

function getWindowsScriptHostPath(executableName) {
  const systemRoot = process.env.SystemRoot || process.env.SYSTEMROOT
  if (systemRoot) {
    return path.join(systemRoot, 'System32', executableName)
  }

  return path.join('C:', 'Windows', 'System32', executableName)
}

async function writeWindowsCommandLauncher(paths) {
  const commandContents = [
    '@echo off',
    'chcp 65001 >nul',
    'setlocal',
    'set NODE_TLS_REJECT_UNAUTHORIZED=',
    `set "HOWCODE_EXE=${escapeWindowsCommandValue(paths.executablePath)}"`,
    `set "HOWCODE_REPO_ROOT=${escapeWindowsCommandValue(paths.launcherWorkingDirectory)}"`,
    'if not exist "%HOWCODE_EXE%" (',
    `  echo ${APP_NAME}: installed app executable was not found.`,
    `  echo Run npx ${APP_NAME} to repair the local install.`,
    '  exit /b 1',
    ')',
    'if "%~1"=="--headless" (',
    '  shift /1',
    '  "%HOWCODE_EXE%" --howcode-headless --ozone-platform=headless %*',
    '  exit /b %ERRORLEVEL%',
    ')',
    'if "%HOWCODE_HEADLESS%"=="1" (',
    '  "%HOWCODE_EXE%" --ozone-platform=headless %*',
    '  exit /b %ERRORLEVEL%',
    ')',
    'start "" /D "%HOWCODE_REPO_ROOT%" "%HOWCODE_EXE%" %*',
    'endlocal',
    '',
  ].join('\r\n')

  await fsp.writeFile(paths.windowsCommandFile, commandContents, 'utf8')
}

async function createWindowsStartMenuShortcut(paths) {
  const shortcutPath = getWindowsStartMenuShortcutPath()
  const shortcutScriptPath = path.join(
    paths.cacheRoot,
    `.create-${APP_NAME}-shortcut-${process.pid}.js`,
  )
  await fsp.mkdir(path.dirname(shortcutPath), { recursive: true })
  await fsp.writeFile(
    shortcutScriptPath,
    [
      "var shell = WScript.CreateObject('WScript.Shell');",
      'var shortcut = shell.CreateShortcut(WScript.Arguments.Item(0));',
      'shortcut.TargetPath = WScript.Arguments.Item(1);',
      'shortcut.WorkingDirectory = WScript.Arguments.Item(2);',
      'shortcut.IconLocation = WScript.Arguments.Item(3);',
      'shortcut.Description = WScript.Arguments.Item(4);',
      'shortcut.Save();',
      '',
    ].join('\r\n'),
    'utf8',
  )

  try {
    await new Promise((resolve, reject) => {
      const child = spawn(
        getWindowsScriptHostPath('cscript.exe'),
        [
          '//NoLogo',
          shortcutScriptPath,
          shortcutPath,
          paths.windowsCommandFile,
          paths.launcherWorkingDirectory,
          `${paths.executablePath},0`,
          'howcode',
        ],
        { stdio: 'ignore', windowsHide: true },
      )
      child.on('error', reject)
      child.on('exit', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`cscript exited with code ${code} while creating Start Menu shortcut.`))
        }
      })
    })
  } finally {
    await fsp.rm(shortcutScriptPath, { force: true })
  }

  return shortcutPath
}

async function ensureCommandLaunchIntegration(target, paths) {
  if (target.os === 'linux') {
    return ensureLinuxLaunchIntegration(target, paths)
  }

  if (target.os !== 'win') {
    return true
  }

  try {
    await writeWindowsCommandLauncher(paths)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`${APP_NAME}: could not create command launcher: ${message}`)
    console.warn(`${APP_NAME}: Start Menu shortcut was not updated.`)
    return false
  }

  try {
    await createWindowsStartMenuShortcut(paths)
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`${APP_NAME}: could not create Start Menu shortcut: ${message}`)
    console.warn(`${APP_NAME}: you can still relaunch with ${paths.windowsCommandFile}`)
    return false
  }
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  const precision = unitIndex === 0 || value >= 10 ? 0 : 1
  return `${value.toFixed(precision)} ${units[unitIndex]}`
}

function createDownloadProgressStream(input) {
  let downloadedBytes = 0
  let lastLoggedAt = 0

  return new Transform({
    transform(chunk, _encoding, callback) {
      downloadedBytes += chunk.length
      input.onProgress(downloadedBytes)

      const now = Date.now()
      if (now - lastLoggedAt >= 1000) {
        lastLoggedAt = now
        const downloadedLabel = formatBytes(downloadedBytes)
        if (input.totalBytes > 0) {
          const percent = Math.min(100, (downloadedBytes / input.totalBytes) * 100)
          const totalLabel = formatBytes(input.totalBytes)
          process.stdout.write(
            `\rDownloading ${APP_NAME}: ${downloadedLabel} / ${totalLabel} (${percent.toFixed(0)}%)`,
          )
        } else {
          process.stdout.write(`\rDownloading ${APP_NAME}: ${downloadedLabel}`)
        }
      }

      callback(null, chunk)
    },
  })
}

async function fetchJson(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_METADATA_TIMEOUT_MS)

  try {
    const response = await fetch(addCacheBust(url), {
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} while fetching ${url}`)
    }
    return await response.json()
  } finally {
    clearTimeout(timeout)
  }
}

async function downloadFile(url, filePath, idleTimeoutMs = DOWNLOAD_IDLE_TIMEOUT_MS) {
  const controller = new AbortController()
  let timedOut = false
  let idleTimeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, idleTimeoutMs)

  const resetIdleTimeout = () => {
    clearTimeout(idleTimeout)
    idleTimeout = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, idleTimeoutMs)
  }

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!(response.ok && response.body)) {
      throw new Error(`HTTP ${response.status} while downloading ${url}`)
    }

    const totalBytes = Number(response.headers.get('content-length')) || 0
    resetIdleTimeout()
    await fsp.mkdir(path.dirname(filePath), { recursive: true })
    await pipeline(
      Readable.fromWeb(response.body),
      createDownloadProgressStream({ totalBytes, onProgress: resetIdleTimeout }),
      fs.createWriteStream(filePath),
    )
    process.stdout.write('\n')
  } catch (error) {
    if (timedOut) {
      throw new Error(`Download stalled for ${Math.round(idleTimeoutMs / 1000)} seconds: ${url}`)
    }
    throw error
  } finally {
    clearTimeout(idleTimeout)
  }
}

async function sha256File(filePath) {
  const hash = crypto.createHash('sha256')
  await pipeline(fs.createReadStream(filePath), hash)
  return hash.digest('hex')
}

async function resolveLatestRelease(target) {
  const channel = getReleaseChannel()
  const releaseBaseUrl = getReleaseBaseUrl(channel)
  const updateUrl = `${releaseBaseUrl}/stable-${target.os}-${target.arch}-update.json`
  const metadata = await fetchJson(updateUrl)
  return validateReleaseMetadata(
    metadata,
    updateUrl,
    releaseBaseUrl,
    channel,
    `${releaseBaseUrl}/${APP_NAME}-${target.os}-${target.arch}.tar.gz`,
  )
}

async function installRelease(target, releaseInfo, paths) {
  const tempRoot = path.join(paths.cacheRoot, `.tmp-${Date.now()}-${process.pid}`)
  const tempInstallDir = `${paths.installDir}.partial`
  const archivePath = path.join(tempRoot, `${APP_NAME}-${target.os}-${target.arch}.tar.gz`)

  console.log(`Downloading ${APP_NAME} ${releaseInfo.version} for ${target.os}-${target.arch}...`)

  await fsp.rm(tempRoot, { recursive: true, force: true })
  await fsp.rm(tempInstallDir, { recursive: true, force: true })
  await fsp.mkdir(tempRoot, { recursive: true })
  await fsp.mkdir(path.dirname(paths.installDir), { recursive: true })
  await downloadFile(releaseInfo.assetUrl, archivePath)

  const archiveHash = await sha256File(archivePath)
  if (archiveHash !== releaseInfo.hash) {
    await fsp.rm(tempRoot, { recursive: true, force: true })
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
  if (process.platform !== 'win32') {
    await fsp.chmod(extractedExecutablePath, 0o755)
  }
  if (
    !isValidInstall({ installDir: tempInstallDir, executablePath: extractedExecutablePath }, target)
  ) {
    throw new Error(`Downloaded archive did not contain ${target.executable}.`)
  }

  await fsp.rm(paths.installDir, { recursive: true, force: true })
  await fsp.rename(tempInstallDir, paths.installDir)
  await fsp.rm(tempRoot, { recursive: true, force: true })

  await writeCurrentFile(paths.currentFile, {
    version: releaseInfo.version,
    channel: releaseInfo.channel,
    hash: releaseInfo.hash,
    installDir: paths.installDir,
    executablePath: paths.executablePath,
  })
}

async function getPruneKeepDirs(cacheRoot, keepDir) {
  const keepDirs = new Set([keepDir])

  for (const channel of Object.keys(CHANNEL_RELEASE_TAGS)) {
    const record = readJsonIfPresent(path.join(cacheRoot, `current-${channel}.json`))
    if (record?.installDir) {
      keepDirs.add(record.installDir)
    }
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

function spawnLauncherProcess(executablePath, options = {}) {
  const args = options.args || []
  const env = {
    ...process.env,
    HOWCODE_REPO_ROOT: process.env.HOWCODE_REPO_ROOT || process.cwd(),
    ...(options.env || {}),
  }
  Reflect.deleteProperty(env, 'NODE_TLS_REJECT_UNAUTHORIZED')

  if (options.foreground) {
    return spawn(executablePath, args, {
      detached: false,
      stdio: options.stdio || 'inherit',
      windowsHide: false,
      cwd: path.dirname(executablePath),
      env,
    })
  }

  if (process.platform === 'linux') {
    return spawnLinuxDetachedLauncher(executablePath, args, env)
  }

  return spawn(executablePath, args, {
    detached: true,
    stdio: options.stdio || 'ignore',
    windowsHide: true,
    cwd: path.dirname(executablePath),
    env,
  })
}

async function waitForDetachedSpawn(child) {
  await new Promise((resolve, reject) => {
    let settled = false
    const settle = (callback) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      callback()
    }
    const timer = setTimeout(() => settle(resolve), 1500)
    child.once('spawn', () => settle(resolve))
    child.once('error', (error) => settle(() => reject(error)))
  })
}

async function launch(executablePath, args) {
  if (!isLaunchableFile(executablePath)) {
    throw new Error(`Installed ${APP_NAME} executable is not launchable: ${executablePath}`)
  }
  const foreground = isHeadlessLaunchArgs(args)
  const child = spawnLauncherProcess(executablePath, { args: getAppLaunchArgs(args), foreground })

  if (foreground) {
    await new Promise((resolve, reject) => {
      child.once('error', reject)
      child.once('exit', (code, signal) => {
        if (signal) {
          reject(new Error(`${APP_NAME} exited with signal ${signal}`))
          return
        }
        resolve(code || 0)
      })
    }).then((code) => {
      process.exitCode = code
    })
    return
  }

  await waitForDetachedSpawn(child)
  child.unref()
}

async function main() {
  const launchArgs = process.argv.slice(2)
  const target = getTarget()
  const cacheRoot = getCacheRoot()
  await fsp.mkdir(cacheRoot, { recursive: true })

  const channel = getReleaseChannel()
  const currentFile = path.join(cacheRoot, `current-${channel}.json`)
  const legacyCurrentFile = path.join(cacheRoot, 'current.json')
  const current =
    readJsonIfPresent(currentFile) ||
    (channel === 'main' ? readJsonIfPresent(legacyCurrentFile) : null)

  let releaseInfo = null
  try {
    releaseInfo = await resolveLatestRelease(target)
  } catch (error) {
    if (current?.executablePath) {
      const currentPaths = {
        cacheRoot,
        currentFile,
        windowsCommandFile: path.join(cacheRoot, `${APP_NAME}.cmd`),
        installDir: current.installDir || path.dirname(path.dirname(current.executablePath)),
        launcherWorkingDirectory: path.dirname(current.executablePath),
        executablePath: current.executablePath,
      }
      if (!isValidInstall(currentPaths, target)) {
        throw error
      }
      await ensureCommandLaunchIntegration(target, {
        ...currentPaths,
      })
      await launch(current.executablePath, launchArgs)
      return
    }

    throw error
  }

  const paths = getPaths(target, releaseInfo)
  let didInstall = false
  let recentlyReplacedDir = null
  await withUpdateLock(paths.cacheRoot, async () => {
    recentlyReplacedDir =
      readJsonIfPresent(paths.currentFile)?.installDir ||
      (releaseInfo.channel === 'main'
        ? readJsonIfPresent(path.join(paths.cacheRoot, 'current.json'))?.installDir
        : null) ||
      null
    didInstall = !isValidInstall(paths, target)
    if (didInstall) await installRelease(target, releaseInfo, paths)
  })

  const launchIntegrationReady = await ensureCommandLaunchIntegration(target, paths)
  if (target.os === 'win' && didInstall && launchIntegrationReady) {
    console.log(`${APP_NAME}: installed. You can relaunch it from the Windows Start Menu.`)
  }
  await pruneOldVersions(cacheRoot, paths.installDir, recentlyReplacedDir)
  await launch(paths.executablePath, launchArgs)
}

module.exports = {
  main: async () => {
    try {
      await main()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`howcode: ${message}`)
      process.exit(1)
    }
  },
}

if (require.main === module) {
  module.exports.main()
}
