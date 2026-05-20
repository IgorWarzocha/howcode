const { spawnSync } = require('node:child_process')
const path = require('node:path')
const { existsSync } = require('node:fs')
const { patchPackagedNodePty } = require('./patch-node-pty-helper.cjs')

const serviceNativePackages = ['better-sqlite3', 'node-pty']

function runNpmRebuildForServiceRuntime(resourcesPath) {
  const unpackedAppPath = path.join(resourcesPath, 'app.asar.unpacked')
  if (!existsSync(unpackedAppPath)) {
    console.warn(`Skipping service native rebuild: ${unpackedAppPath} does not exist.`)
    return
  }

  const result = spawnSync('npm', ['rebuild', ...serviceNativePackages, '--build-from-source'], {
    cwd: unpackedAppPath,
    env: {
      ...process.env,
      npm_config_runtime: 'node',
      npm_config_target: process.versions.node,
      npm_config_disturl: 'https://nodejs.org/download/release',
    },
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    throw new Error(
      `Failed to rebuild packaged service native dependencies for stock Node: ${serviceNativePackages.join(', ')}.`,
    )
  }
}

exports.default = async function afterPack(context) {
  const resourcesPath =
    context.electronPlatformName === 'darwin'
      ? path.join(
          context.appOutDir,
          `${context.packager.appInfo.productFilename}.app/Contents/Resources`,
        )
      : path.join(context.appOutDir, 'resources')

  runNpmRebuildForServiceRuntime(resourcesPath)

  if (context.electronPlatformName === 'win32') return

  const result = patchPackagedNodePty(resourcesPath)
  console.log(
    `Patched packaged node-pty helper resolution at ${result.unixTerminalPath}; executable helpers: ${result.executableHelpers.length}`,
  )
}
