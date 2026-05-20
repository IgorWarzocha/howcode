import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import serviceNativeAbi from '../../shared/service-native-abi.json'

const supportedServiceNodeAbis = new Set(serviceNativeAbi.supportedServiceNodeAbis)

type NodeRuntimeProbe = {
  version: string
  abi: string
}

export function getSupportedServiceNodeAbiLabel() {
  return [...supportedServiceNodeAbis].join(', ')
}

export async function probeNodeRuntime(nodeExecutable: string): Promise<NodeRuntimeProbe> {
  return await new Promise((resolve, reject) => {
    const child = spawn(
      nodeExecutable,
      ['-p', 'JSON.stringify({version: process.version, abi: process.versions.modules})'],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    )
    let stdout = ''
    let stderr = ''
    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`Timed out probing Node runtime: ${nodeExecutable}`))
    }, 3_000)
    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')
    child.stdout?.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr?.on('data', (chunk) => {
      stderr += chunk
    })
    child.once('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.once('exit', (code) => {
      clearTimeout(timeout)
      if (code !== 0) {
        reject(new Error(`Failed to probe Node runtime ${nodeExecutable}: ${stderr.trim()}`))
        return
      }
      try {
        const parsed = JSON.parse(stdout.trim()) as Partial<NodeRuntimeProbe>
        if (typeof parsed.version !== 'string' || typeof parsed.abi !== 'string') {
          throw new Error('probe did not return version/abi')
        }
        resolve({ version: parsed.version, abi: parsed.abi })
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  })
}

function getUnpackedAppPath(resourcesPath: string) {
  return path.join(resourcesPath, 'app.asar.unpacked')
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
  }
  if (manifest.abi !== abi || !Array.isArray(manifest.files)) {
    throw new Error(`Invalid packaged native dependency manifest for ABI ${abi}: ${manifestPath}`)
  }

  for (const relativePath of serviceNativeAbi.nativeRuntimeFiles) {
    const sourcePath = path.join(abiBundleRoot, relativePath)
    if (!existsSync(sourcePath)) {
      throw new Error(`Missing packaged native dependency for ABI ${abi}: ${sourcePath}`)
    }
  }
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
  if (resourcesPath && existsSync(path.join(resourcesPath, 'app.asar.unpacked'))) {
    validateAbiNativeDependencies(resourcesPath, runtime.abi)
  }

  return runtime
}
