import { existsSync } from 'node:fs'
import path from 'node:path'
import serviceNativeAbi from '../shared/service-native-abi.json'

function getElectronResourcesPath() {
  // biome-ignore lint/complexity/useLiteralKeys: ProcessEnv is an index-signature type.
  return process.env['HOWCODE_ELECTRON_RESOURCES_PATH']?.trim() ?? ''
}

function activateNativeDependenciesForCurrentNode() {
  const resourcesPath = getElectronResourcesPath()
  if (!resourcesPath) return

  const unpackedAppPath = path.join(resourcesPath, 'app.asar.unpacked')
  if (!existsSync(unpackedAppPath)) return

  const abi = process.versions.modules
  const abiBundleRoot = path.join(
    unpackedAppPath,
    serviceNativeAbi.nativeServiceAbiDirectoryName,
    abi,
  )
  if (!existsSync(abiBundleRoot)) return
  const abiNodeModulesPath = path.join(abiBundleRoot, 'node_modules')
  // biome-ignore lint/complexity/useLiteralKeys: ProcessEnv is an index-signature type.
  process.env['HOWCODE_SERVICE_NATIVE_NODE_MODULES'] = abiNodeModulesPath
}

activateNativeDependenciesForCurrentNode()
const runtimeEntrypoint = './service-host-runtime.mjs'
await import(runtimeEntrypoint)
