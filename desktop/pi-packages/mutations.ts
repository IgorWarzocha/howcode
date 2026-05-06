import type { PiPackageMutationResult } from '../../shared/desktop-contracts.ts'
import {
  markRuntimeSettingsStaleForProject,
  markRuntimeSettingsStaleForSettingsCwd,
} from '../runtime/runtime-registry.ts'
import { listConfiguredPiPackages } from './configured.ts'
import { normalizePiPackageSource } from './helpers.ts'
import { getPiPackageServices } from './services.ts'

export async function installPiPackage(request: {
  source: string
  kind?: 'npm' | 'git' | undefined
  local?: boolean | undefined
  projectPath?: string | undefined | null | undefined
  chat?: boolean | undefined
}): Promise<PiPackageMutationResult> {
  const normalizedSource = normalizePiPackageSource(request.source, request.kind ?? 'npm')

  if (!normalizedSource) {
    throw new Error('Enter a package source.')
  }

  const { packageManager, projectPath } = await getPiPackageServices(request)
  const configuredProjectPath = request.chat ? request.projectPath : projectPath
  const local = request.local || request.chat
  await packageManager.installAndPersist(normalizedSource, local ? { local: true } : {})
  if (request.chat) {
    await markRuntimeSettingsStaleForSettingsCwd(projectPath)
  } else {
    await markRuntimeSettingsStaleForProject(local ? projectPath : null)
  }

  return {
    source: request.source,
    normalizedSource,
    configuredPackages: await listConfiguredPiPackages({
      projectPath: configuredProjectPath,
      chat: request.chat,
    }),
  }
}

export async function removePiPackage(request: {
  source: string
  local?: boolean | undefined
  projectPath?: string | undefined | null | undefined
  chat?: boolean | undefined
}): Promise<PiPackageMutationResult> {
  const source = request.source.trim()

  if (source.length === 0) {
    throw new Error('Choose a package to remove.')
  }

  const { packageManager, projectPath } = await getPiPackageServices(request)
  const configuredProjectPath = request.chat ? request.projectPath : projectPath
  const local = request.local || request.chat
  await packageManager.removeAndPersist(source, local ? { local: true } : {})
  if (request.chat) {
    await markRuntimeSettingsStaleForSettingsCwd(projectPath)
  } else {
    await markRuntimeSettingsStaleForProject(local ? projectPath : null)
  }

  return {
    source,
    normalizedSource: source,
    configuredPackages: await listConfiguredPiPackages({
      projectPath: configuredProjectPath,
      chat: request.chat,
    }),
  }
}
