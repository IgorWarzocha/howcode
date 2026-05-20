import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const nativeServiceAbiDirectoryName = 'native-node-abi'
const nativeRuntimeFiles = [
  path.join('node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'),
  path.join('node_modules', 'node-pty', 'build', 'Release', 'pty.node'),
]

function getElectronResourcesPath() {
  // biome-ignore lint/complexity/useLiteralKeys: ProcessEnv is an index-signature type.
  return process.env['HOWCODE_ELECTRON_RESOURCES_PATH']?.trim() ?? ''
}

function installNativeDependenciesForCurrentNode() {
  const resourcesPath = getElectronResourcesPath()
  if (!resourcesPath) return

  const unpackedAppPath = path.join(resourcesPath, 'app.asar.unpacked')
  if (!existsSync(unpackedAppPath)) return

  const abi = process.versions.modules
  const abiBundleRoot = path.join(unpackedAppPath, nativeServiceAbiDirectoryName, abi)
  if (!existsSync(abiBundleRoot)) return

  for (const relativePath of nativeRuntimeFiles) {
    const sourcePath = path.join(abiBundleRoot, relativePath)
    const destinationPath = path.join(unpackedAppPath, relativePath)
    if (!existsSync(sourcePath)) continue
    mkdirSync(path.dirname(destinationPath), { recursive: true })
    copyFileSync(sourcePath, destinationPath)
  }
}

installNativeDependenciesForCurrentNode()
const runtimeEntrypoint = './service-host-runtime.mjs'
await import(runtimeEntrypoint)
