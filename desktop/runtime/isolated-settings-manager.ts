import path from 'node:path'
import type { ResourceLoader, SettingsManager } from '@earendil-works/pi-coding-agent'

type SettingsManagerFactory = {
  create: (
    cwd: string,
    agentDir?: string | undefined,
    options?: { projectTrusted: boolean } | undefined,
  ) => SettingsManager
  inMemory: (settings?: Record<string, unknown>) => SettingsManager
}

type ProjectTrustStoreFactory = new (
  agentDir: string,
) => {
  get: (cwd: string) => boolean | null
}

const isolatedResourceSettingsKeys = ['packages', 'extensions', 'skills', 'prompts', 'themes']

function getSettingsArray(value: unknown) {
  return Array.isArray(value) ? value : []
}

function createIsolatedSettings(
  globalSettings: Record<string, unknown>,
  projectSettings: Record<string, unknown>,
): Record<string, unknown> & { extensions?: unknown[] } {
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
  additionalExtensions?: string[] | undefined
  projectTrusted?: boolean | undefined
}) {
  const diskSettingsManager = options.SettingsManager.create(
    options.settingsCwd ?? options.cwd,
    options.agentDir,
    options.projectTrusted === undefined ? undefined : { projectTrusted: options.projectTrusted },
  )

  if (!options.settingsCwd && (options.additionalExtensions?.length ?? 0) === 0) {
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

  const isolatedSettings = createIsolatedSettings(globalSettings, projectSettings)
  const additionalExtensions = options.additionalExtensions ?? []
  if (additionalExtensions.length > 0) {
    isolatedSettings.extensions = [
      ...getSettingsArray(isolatedSettings.extensions),
      ...additionalExtensions,
    ]
  }

  return options.SettingsManager.inMemory(isolatedSettings)
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
  projectTrusted?: boolean | undefined
  systemPrompt?: string | undefined
}) {
  const resourceLoader = new options.DefaultResourceLoader({
    cwd: options.cwd,
    agentDir: options.agentDir,
    settingsManager: options.settingsManager,
    ...(options.systemPrompt ? { systemPrompt: options.systemPrompt } : {}),
    ...(options.settingsCwd
      ? {
          noSkills: true,
          additionalSkillPaths: [
            path.join(options.settingsCwd, '.pi', 'skills'),
            path.join(options.settingsCwd, '.agents', 'skills'),
          ],
        }
      : {}),
  })
  await resourceLoader.reload({
    resolveProjectTrust: async () => options.projectTrusted ?? false,
  })
  return resourceLoader
}

export function resolveRuntimeProjectTrust(options: {
  ProjectTrustStore: ProjectTrustStoreFactory
  agentDir: string
  cwd: string
  hasProjectTrustInputs: (cwd: string) => boolean
  settingsCwd?: string | null | undefined
}) {
  const trustCwd = options.settingsCwd ?? options.cwd
  if (!options.hasProjectTrustInputs(trustCwd)) return true

  const storedDecision = new options.ProjectTrustStore(options.agentDir).get(trustCwd)
  return storedDecision ?? false
}
