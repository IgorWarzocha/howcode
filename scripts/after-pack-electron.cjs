const path = require('node:path')
const {
  buildReleaseServiceNativeAbiBundles,
} = require('./build-release-service-native-abi-bundles.cjs')
const { patchNodePtyRoot, patchPackagedNodePty } = require('./patch-node-pty-helper.cjs')
const {
  copyCurrentNativeDependenciesToAbiBundle,
  getAbiBundleRoot,
  rebuildServiceNativeDependencies,
  supportedServiceNodeAbis,
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

  const shouldPatchNodePty = context.electronPlatformName !== 'win32'
  const patchNodePtyBundles = () => {
    if (!shouldPatchNodePty) return

    const patchResults = [patchPackagedNodePty(resourcesPath)]
    for (const abi of supportedServiceNodeAbis) {
      patchResults.push(
        patchNodePtyRoot(
          path.join(getAbiBundleRoot(resourcesPath, abi), 'node_modules', 'node-pty'),
          {
            optional: true,
          },
        ),
      )
    }
    for (const result of patchResults) {
      console.log(
        `Patched packaged node-pty helper resolution at ${result.unixTerminalPath}; executable helpers: ${result.executableHelpers.length}`,
      )
    }
  }

  if (rebuildServiceNativeDependencies(resourcesPath)) {
    copyCurrentNativeDependenciesToAbiBundle(resourcesPath)
    patchNodePtyBundles()
    validateCurrentNativeDependenciesLoad(resourcesPath)
  }

  if (process.env.HOWCODE_BUILD_ALL_SERVICE_NATIVE_ABIS === '1') {
    buildReleaseServiceNativeAbiBundles(resourcesPath)
    patchNodePtyBundles()
  }
}
