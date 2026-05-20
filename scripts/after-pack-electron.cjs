const path = require('node:path')
const { patchPackagedNodePty } = require('./patch-node-pty-helper.cjs')
const {
  copyCurrentNativeDependenciesToAbiBundle,
  rebuildServiceNativeDependencies,
  validateCurrentNativeDependenciesLoad,
} = require('./service-native-abi.cjs')

exports.default = async function afterPack(context) {
  const resourcesPath =
    context.electronPlatformName === 'darwin'
      ? path.join(
          context.appOutDir,
          `${context.packager.appInfo.productFilename}.app/Contents/Resources`,
        )
      : path.join(context.appOutDir, 'resources')

  if (rebuildServiceNativeDependencies(resourcesPath)) {
    copyCurrentNativeDependenciesToAbiBundle(resourcesPath)
    validateCurrentNativeDependenciesLoad(resourcesPath)
  }

  if (context.electronPlatformName === 'win32') return

  const result = patchPackagedNodePty(resourcesPath)
  console.log(
    `Patched packaged node-pty helper resolution at ${result.unixTerminalPath}; executable helpers: ${result.executableHelpers.length}`,
  )
}
