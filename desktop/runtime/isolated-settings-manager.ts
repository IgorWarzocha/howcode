import path from 'node:path'
import type { ResourceLoader, SettingsManager } from '@earendil-works/pi-coding-agent'

type SettingsManagerFactory = {
  create: (cwd: string, agentDir?: string | undefined) => SettingsManager
  inMemory: (settings?: Record<string, unknown>) => SettingsManager
}

const isolatedResourceSettingsKeys = ['packages', 'extensions', 'skills', 'prompts', 'themes']

function getSettingsArray(value: unknown) {
  return Array.isArray(value) ? value : []
}

function createIsolatedSettings(
  globalSettings: Record<string, unknown>,
  projectSettings: Record<string, unknown>,
) {
  return {
    ...globalSettings,
    ...projectSettings,
    ...Object.fromEntries(
      isolatedResourceSettingsKeys.map((key) => [key, getSettingsArray(projectSettings[key])]),
    ),
  }
}

export function createRuntimeSettingsManager(options: {
  SettingsManager: SettingsManagerFactory
  cwd: string
  agentDir: string
  settingsCwd?: string | null | undefined
}) {
  const diskSettingsManager = options.SettingsManager.create(
    options.settingsCwd ?? options.cwd,
    options.agentDir,
  )

  if (!options.settingsCwd) {
    return diskSettingsManager
  }

  const globalSettings = diskSettingsManager.getGlobalSettings() as unknown as Record<
    string,
    unknown
  >
  const projectSettings = diskSettingsManager.getProjectSettings() as unknown as Record<
    string,
    unknown
  >

  return options.SettingsManager.inMemory(createIsolatedSettings(globalSettings, projectSettings))
}

export async function createIsolatedRuntimeResourceLoader(options: {
  DefaultResourceLoader: new (loaderOptions: {
    cwd: string
    agentDir: string
    settingsManager: SettingsManager
    noSkills?: boolean
    additionalSkillPaths?: string[]
    systemPrompt?: string
  }) => ResourceLoader
  cwd: string
  agentDir: string
  settingsCwd?: string | null | undefined
  settingsManager: SettingsManager
  systemPrompt?: string | undefined
}) {
  if (!options.settingsCwd) {
    return undefined
  }

  const resourceLoader = new options.DefaultResourceLoader({
    cwd: options.cwd,
    agentDir: options.agentDir,
    settingsManager: options.settingsManager,
    noSkills: true,
    ...(options.systemPrompt ? { systemPrompt: options.systemPrompt } : {}),
    additionalSkillPaths: [
      path.join(options.settingsCwd, '.pi', 'skills'),
      path.join(options.settingsCwd, '.agents', 'skills'),
    ],
  })
  await resourceLoader.reload()
  return resourceLoader
}
