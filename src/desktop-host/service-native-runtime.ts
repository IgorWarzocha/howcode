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

function parseNodeRuntimeProbe(stdout: string): NodeRuntimeProbe {
  const parsed = JSON.parse(stdout.trim()) as Partial<NodeRuntimeProbe>
  if (typeof parsed.version !== 'string' || typeof parsed.abi !== 'string') {
    throw new Error('probe did not return version/abi')
  }
  return { version: parsed.version, abi: parsed.abi }
}

function rejectNodeProbeExit(nodeExecutable: string, stderr: string, code: number | null) {
  return new Error(
    `Failed to probe Node runtime ${nodeExecutable} (exit ${code ?? 'unknown'}): ${stderr.trim()}`,
  )
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
    let settled = false

    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      callback()
    }

    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      finish(() => reject(new Error(`Timed out probing Node runtime: ${nodeExecutable}`)))
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
      finish(() => reject(error))
    })
    child.once('close', (code) => {
      finish(() => {
        if (code !== 0) {
          reject(rejectNodeProbeExit(nodeExecutable, stderr, code))
          return
        }
        try {
          resolve(parseNodeRuntimeProbe(stdout))
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)))
        }
      })
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

  for (const relativePath of serviceNativeAbi.requiredNativeRuntimeFiles) {
    const sourcePath = path.join(abiBundleRoot, relativePath)
    if (!existsSync(sourcePath)) {
      throw new Error(`Missing packaged native dependency for ABI ${abi}: ${sourcePath}`)
    }
  }
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
