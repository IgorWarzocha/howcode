#!/usr/bin/env node

const childProcess = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const electronDir = path.join(__dirname, '..', 'node_modules', 'electron')
const electronPackageJsonPath = path.join(electronDir, 'package.json')
const leadingVersionPrefixPattern = /^v/

if (process.env.ELECTRON_SKIP_BINARY_DOWNLOAD) {
  process.exit(0)
}

function getPlatformPath() {
  const platform = process.env.npm_config_platform || os.platform()
  switch (platform) {
    case 'mas':
    case 'darwin':
      return 'Electron.app/Contents/MacOS/Electron'
    case 'freebsd':
    case 'openbsd':
    case 'linux':
      return 'electron'
    case 'win32':
      return 'electron.exe'
    default:
      throw new Error(`Electron builds are not available on platform: ${platform}`)
  }
}

function isInstalled() {
  const platformPath = getPlatformPath()
  const { version } = require(electronPackageJsonPath)
  const distPath = process.env.ELECTRON_OVERRIDE_DIST_PATH || path.join(electronDir, 'dist')
  const executablePath = process.env.ELECTRON_OVERRIDE_DIST_PATH
    ? path.join(process.env.ELECTRON_OVERRIDE_DIST_PATH, platformPath)
    : path.join(distPath, platformPath)

  try {
    return (
      fs
        .readFileSync(path.join(distPath, 'version'), 'utf8')
        .replace(leadingVersionPrefixPattern, '') === version &&
      fs.readFileSync(path.join(electronDir, 'path.txt'), 'utf8') === platformPath &&
      fs.existsSync(executablePath)
    )
  } catch {
    return false
  }
}

function getInstallTarget() {
  const platform = process.env.npm_config_platform || process.platform
  let arch = process.env.npm_config_arch || process.arch

  if (
    platform === 'darwin' &&
    process.platform === 'darwin' &&
    arch === 'x64' &&
    !process.env.npm_config_arch
  ) {
    try {
      const output = childProcess.execSync('sysctl -in sysctl.proc_translated')
      if (output.toString().trim() === '1') {
        arch = 'arm64'
      }
    } catch {
      // Rosetta detection is best-effort; fall back to the requested architecture.
    }
  }

  return { platform, arch }
}

async function extractZip(zipPath, distPath) {
  // Electron's upstream installer uses extract-zip, which can silently stop after
  // the first entry under Node 26. The Electron archives are ordinary zip files,
  // so use OS-provided archive tools and verify the executable afterward.
  if (process.platform === 'win32') {
    childProcess.execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Expand-Archive -LiteralPath $args[0] -DestinationPath $args[1] -Force',
        zipPath,
        distPath,
      ],
      { stdio: 'inherit' },
    )
    return
  }

  try {
    childProcess.execFileSync('unzip', ['-q', zipPath, '-d', distPath], { stdio: 'inherit' })
  } catch (error) {
    if (error && error.code !== 'ENOENT') throw error
    console.warn('[howcode] System unzip not found; falling back to bundled JS zip extraction.')
    await require('extract-zip')(zipPath, { dir: distPath })
  }
}

async function installElectron() {
  const { downloadArtifact } = require('@electron/get')
  const { version } = require(electronPackageJsonPath)
  const { platform, arch } = getInstallTarget()

  const zipPath = await downloadArtifact({
    version,
    artifactName: 'electron',
    force: process.env.force_no_cache === 'true',
    cacheRoot: process.env.electron_config_cache,
    checksums:
      process.env.electron_use_remote_checksums ||
      process.env.npm_config_electron_use_remote_checksums
        ? undefined
        : require(path.join(electronDir, 'checksums.json')),
    platform,
    arch,
  })

  const distPath = process.env.ELECTRON_OVERRIDE_DIST_PATH || path.join(electronDir, 'dist')
  fs.rmSync(distPath, { recursive: true, force: true })
  fs.mkdirSync(distPath, { recursive: true })

  await extractZip(zipPath, distPath)

  const typeDefPath = path.join(distPath, 'electron.d.ts')
  if (fs.existsSync(typeDefPath)) {
    fs.renameSync(typeDefPath, path.join(electronDir, 'electron.d.ts'))
  }
  fs.writeFileSync(path.join(electronDir, 'path.txt'), getPlatformPath())
}

async function main() {
  if (!isInstalled()) {
    console.warn('[howcode] Installing Electron with verified zip extraction.')
    await installElectron()
  }

  if (!isInstalled()) {
    throw new Error('Electron failed to install correctly')
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
