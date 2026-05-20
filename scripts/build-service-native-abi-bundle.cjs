#!/usr/bin/env node
const path = require('node:path')
const { patchNodePtyRoot } = require('./patch-node-pty-helper.cjs')
const {
  copyCurrentNativeDependenciesToAbiBundle,
  rebuildServiceNativeDependencies,
  validateCurrentNativeDependenciesLoad,
} = require('./service-native-abi.cjs')

const resourcesPath = process.argv[2]
if (!resourcesPath) {
  console.error('Usage: node scripts/build-service-native-abi-bundle.cjs <packaged resources path>')
  process.exit(1)
}

const resolvedResourcesPath = path.resolve(resourcesPath)
if (!rebuildServiceNativeDependencies(resolvedResourcesPath)) {
  console.error(
    `Could not rebuild service native dependencies: ${resolvedResourcesPath} is not a packaged resources path with app.asar.unpacked.`,
  )
  process.exit(1)
}
const bundleRoot = copyCurrentNativeDependenciesToAbiBundle(resolvedResourcesPath)
if (process.platform !== 'win32') {
  patchNodePtyRoot(path.join(bundleRoot, 'node_modules', 'node-pty'))
}
validateCurrentNativeDependenciesLoad(resolvedResourcesPath)
console.log(
  `Built service native ABI bundle ${process.versions.modules} for ${process.version} at ${bundleRoot}`,
)
