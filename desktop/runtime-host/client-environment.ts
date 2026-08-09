import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as Effect from 'effect/Effect'
import { discoverNodeExecutable } from '../../node-runtime/node-executable'

function getProcessEnvironmentVariable(name: string) {
  return process.env[name]
}

let cachedNodeExecutable: string | null = null

export function getRuntimeHostPath() {
  const siblingWorkerPath = fileURLToPath(new URL('./worker.mjs', import.meta.url))
  const siblingUnpackedWorkerPath = getAsarUnpackedPath(siblingWorkerPath)
  if (siblingUnpackedWorkerPath && existsSync(siblingUnpackedWorkerPath)) {
    return siblingUnpackedWorkerPath
  }
  if (existsSync(siblingWorkerPath)) return siblingWorkerPath

  const bundledBridgeWorkerPath = fileURLToPath(new URL('./desktop/worker.mjs', import.meta.url))
  const bundledBridgeUnpackedWorkerPath = getAsarUnpackedPath(bundledBridgeWorkerPath)
  if (bundledBridgeUnpackedWorkerPath && existsSync(bundledBridgeUnpackedWorkerPath)) {
    return bundledBridgeUnpackedWorkerPath
  }
  if (existsSync(bundledBridgeWorkerPath)) return bundledBridgeWorkerPath

  return path.join(process.cwd(), 'build', 'desktop', 'worker.mjs')
}

function getAsarUnpackedPath(filePath: string) {
  return filePath.includes('.asar') ? filePath.replace('.asar', '.asar.unpacked') : null
}

export async function getNodeExecutable() {
  if (cachedNodeExecutable) return cachedNodeExecutable

  const discovered = await Effect.runPromise(
    discoverNodeExecutable({
      environmentCandidates: [
        getProcessEnvironmentVariable('HOWCODE_NODE_PATH'),
        getProcessEnvironmentVariable('NODE'),
      ],
      requireAbsoluteEnvironmentPath: false,
      requireAbsoluteShellPath: true,
      shellFlags: () => ['-lc'],
      shells: [getProcessEnvironmentVariable('SHELL'), '/bin/bash', '/bin/zsh', '/bin/sh'],
    }),
  )

  // Do not use Electron's process.execPath here: it would put Pi extensions back on the
  // Electron ABI. If discovery reaches this fallback, spawn will fail with a clear host error.
  cachedNodeExecutable = discovered ?? 'node'
  return cachedNodeExecutable
}

export function getElectronResourcesPath() {
  const processWithResourcesPath = process as NodeJS.Process & {
    resourcesPath?: string | undefined
  }
  return (
    getProcessEnvironmentVariable('HOWCODE_ELECTRON_RESOURCES_PATH')?.trim() ||
    processWithResourcesPath.resourcesPath ||
    ''
  )
}

export function getBundledSkillsPath() {
  const configuredPath = getProcessEnvironmentVariable('HOWCODE_BUNDLED_SKILLS_PATH')?.trim()
  if (configuredPath) return configuredPath
  const resourcesPath = getElectronResourcesPath()
  return resourcesPath
    ? path.join(resourcesPath, 'resources', 'skills')
    : path.join(process.cwd(), 'desktop', 'resources', 'skills')
}
