import { describe, expect, it } from 'vitest'
import { createRuntimeSettingsManager } from './isolated-settings-manager.ts'

type Settings = Record<string, unknown>

function createSettingsManagerFactory(globalSettings: Settings, projectSettings: Settings) {
  return {
    create: () => ({
      getGlobalSettings: () => globalSettings,
      getProjectSettings: () => projectSettings,
    }),
    inMemory: (settings: Settings = {}) => settings,
  } as unknown as Parameters<typeof createRuntimeSettingsManager>[0]['SettingsManager']
}

describe('createRuntimeSettingsManager', () => {
  it('isolates configured resources from global settings when using an internal settings cwd', () => {
    const settingsManager = createRuntimeSettingsManager({
      SettingsManager: createSettingsManagerFactory(
        {
          model: 'global-model',
          packages: ['global-package'],
          extensions: ['global-extension'],
          skills: ['global-skill'],
          prompts: ['global-prompt'],
          themes: ['global-theme'],
        },
        {
          packages: ['chat-package'],
          extensions: ['chat-extension'],
          skills: ['chat-skill'],
          prompts: ['chat-prompt'],
          themes: ['chat-theme'],
        },
      ),
      cwd: '/repo',
      agentDir: '/agent',
      settingsCwd: '/internal-chat',
    }) as unknown as Settings

    expect(settingsManager).toMatchObject({
      model: 'global-model',
      packages: ['chat-package'],
      extensions: ['chat-extension'],
      skills: ['chat-skill'],
      prompts: ['chat-prompt'],
      themes: ['chat-theme'],
    })
  })
})
