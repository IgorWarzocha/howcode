import { existsSync } from 'node:fs'
import path from 'node:path'
import { getChatSessionDir } from '../chat-session-dir.ts'
import { getPiModule } from '../pi-module.ts'
import type { PiPackageManager, PiSettingsManager } from './types.ts'

export function resolvePiPackageProjectPath(request: {
  projectPath?: string | undefined | null | undefined
  chat?: boolean | undefined
}) {
  return request.chat ? getChatSessionDir() : request.projectPath
}

export async function getPiPackageServices(
  request: { projectPath?: string | undefined | null | undefined; chat?: boolean | undefined } = {},
): Promise<{
  packageManager: PiPackageManager
  settingsManager: PiSettingsManager
  agentDir: string
  projectPath: string | null
}> {
  const { DefaultPackageManager, SettingsManager, getAgentDir } = await getPiModule()
  const agentDir = getAgentDir()
  const resolvedProjectPath = resolvePiPackageProjectPath(request)
  const projectPath = resolvedProjectPath?.trim() ? path.resolve(resolvedProjectPath) : null
  const cwd = projectPath ?? agentDir
  const settingsManager = SettingsManager.create(cwd, agentDir)

  return {
    packageManager: new DefaultPackageManager({
      cwd,
      agentDir,
      settingsManager,
    }) as unknown as PiPackageManager,
    settingsManager: settingsManager as unknown as PiSettingsManager,
    agentDir,
    projectPath,
  }
}

export function resolveConfiguredExtensionPath(extensionPath: string, settingsPath: string) {
  const resolvedPath = path.isAbsolute(extensionPath)
    ? extensionPath
    : path.resolve(path.dirname(settingsPath), extensionPath)

  return existsSync(resolvedPath) ? resolvedPath : undefined
}
