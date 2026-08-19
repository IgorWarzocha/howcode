import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'
import { runProcessProbe } from '../../node-runtime/process-probe'
import serviceNativeAbi from '../../shared/service-native-abi.json'

const supportedServiceNodeAbis = new Set(serviceNativeAbi.supportedServiceNodeAbis)

const NodeRuntimeProbe = Schema.Struct({
  version: Schema.String,
  abi: Schema.String,
})
export interface NodeRuntimeProbe extends Schema.Schema.Type<typeof NodeRuntimeProbe> {}

export function getSupportedServiceNodeAbiLabel() {
  return [...supportedServiceNodeAbis].join(', ')
}

function rejectNodeProbeExit(nodeExecutable: string, stderr: string, code: number | null) {
  return new Error(
    `Failed to probe Node runtime ${nodeExecutable} (exit ${code ?? 'unknown'}): ${stderr.trim()}`,
  )
}

export async function probeNodeRuntime(nodeExecutable: string): Promise<NodeRuntimeProbe> {
  return await Effect.runPromise(
    Effect.gen(function* () {
      const result = yield* runProcessProbe({
        executable: nodeExecutable,
        args: ['-p', 'JSON.stringify({version: process.version, abi: process.versions.modules})'],
        timeout: 3_000,
        timeoutMessage: `Timed out probing Node runtime: ${nodeExecutable}`,
      })
      if (result.exitCode !== 0)
        return yield* Effect.fail(
          rejectNodeProbeExit(nodeExecutable, result.stderr, result.exitCode),
        )
      const parsed = yield* Effect.try({
        try: () => JSON.parse(result.stdout.trim()),
        catch: (error) => (error instanceof Error ? error : new Error(String(error))),
      })
      return yield* Schema.decodeUnknownEffect(NodeRuntimeProbe)(parsed)
    }),
  )
}

function getUnpackedAppPath(resourcesPath: string) {
  return path.join(resourcesPath, 'app.asar.unpacked')
}

function getBetterSqlitePrebuildPath() {
  return path.join(
    'node_modules',
    'better-sqlite3',
    'prebuilds',
    `${process.platform}-${process.arch}.node`,
  )
}

function validateAbiNativeDependencies(resourcesPath: string, abi: string) {
  const unpackedAppPath = getUnpackedAppPath(resourcesPath)
  const abiBundleRoot = path.join(
    unpackedAppPath,
    serviceNativeAbi.nativeServiceAbiDirectoryName,
    abi,
  )

  if (!existsSync(abiBundleRoot)) {
    throw new Error(
      `Missing packaged native dependencies for Node ABI ${abi}. Supported ABIs: ${getSupportedServiceNodeAbiLabel()}.`,
    )
  }

  const manifestPath = path.join(abiBundleRoot, 'manifest.json')
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing packaged native dependency manifest for ABI ${abi}: ${manifestPath}`)
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    abi?: unknown
    files?: unknown
    packages?: unknown
  }
  const manifestPackages = Array.isArray(manifest.packages) ? manifest.packages : null
  const manifestPackageSet = manifestPackages ? new Set(manifestPackages) : null
  if (
    manifest.abi !== abi ||
    !Array.isArray(manifest.files) ||
    !manifestPackageSet ||
    !serviceNativeAbi.serviceAbiPackages.every((packageName) => manifestPackageSet.has(packageName))
  ) {
    throw new Error(`Invalid packaged native dependency manifest for ABI ${abi}: ${manifestPath}`)
  }

  for (const packageName of serviceNativeAbi.serviceAbiPackages) {
    const packageManifestPath = path.join(
      abiBundleRoot,
      'node_modules',
      packageName,
      'package.json',
    )
    if (!existsSync(packageManifestPath)) {
      throw new Error(`Missing packaged native dependency for ABI ${abi}: ${packageManifestPath}`)
    }
  }

  const betterSqlitePrebuildPath = path.join(unpackedAppPath, getBetterSqlitePrebuildPath())
  if (!existsSync(betterSqlitePrebuildPath))
    throw new Error(`Missing packaged stock-Node SQLite prebuild: ${betterSqlitePrebuildPath}`)
}

function hasPackagedNativeDependencies(resourcesPath: string) {
  return existsSync(getUnpackedAppPath(resourcesPath))
}

export async function prepareServiceNativeRuntime(input: {
  nodeExecutable: string
  resourcesPath?: string | undefined
}) {
  const runtime = await probeNodeRuntime(input.nodeExecutable)
  if (!supportedServiceNodeAbis.has(runtime.abi)) {
    throw new Error(
      `Howcode desktop service requires Node ABI ${getSupportedServiceNodeAbiLabel()} (Node 24-26). ${input.nodeExecutable} is ${runtime.version} ABI ${runtime.abi}.`,
    )
  }

  const resourcesPath = input.resourcesPath?.trim()
  if (resourcesPath && hasPackagedNativeDependencies(resourcesPath)) {
    validateAbiNativeDependencies(resourcesPath, runtime.abi)
  }

  return runtime
}
