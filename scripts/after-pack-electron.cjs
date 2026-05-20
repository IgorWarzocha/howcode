const path = require('node:path')
const {
  buildReleaseServiceNativeAbiBundles,
} = require('./build-release-service-native-abi-bundles.cjs')
const { patchNodePtyRoot } = require('./patch-node-pty-helper.cjs')
const { getPatchableNodePtyRoots } = require('./service-native/platform.cjs')
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

  const patchNodePtyBundles = () => {
    const patchResults = []
    for (const nodePtyRoot of getPatchableNodePtyRoots(
      path.join(resourcesPath, 'app.asar.unpacked'),
    )) {
      patchResults.push(patchNodePtyRoot(nodePtyRoot, { optional: true }))
    }
    for (const abi of supportedServiceNodeAbis) {
      for (const nodePtyRoot of getPatchableNodePtyRoots(getAbiBundleRoot(resourcesPath, abi))) {
        patchResults.push(patchNodePtyRoot(nodePtyRoot, { optional: true }))
      }
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

  buildReleaseServiceNativeAbiBundles(resourcesPath)
  patchNodePtyBundles()
}
