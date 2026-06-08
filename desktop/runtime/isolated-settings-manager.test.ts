import { describe, expect, it } from 'vitest'
import {
  createRuntimeSettingsManager,
  resolveRuntimeProjectTrust,
} from './isolated-settings-manager.ts'

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
  it('keeps global resources and adds internal project resources when using an internal settings cwd', () => {
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
      packages: ['global-package', 'chat-package'],
      extensions: ['global-extension', 'chat-extension'],
      skills: ['global-skill', 'chat-skill'],
      prompts: ['global-prompt', 'chat-prompt'],
      themes: ['global-theme', 'chat-theme'],
    })
  })
})

describe('resolveRuntimeProjectTrust', () => {
  function createTrustStoreFactory(decision: boolean | null | Record<string, boolean | null>) {
    return class ProjectTrustStore {
      agentDir: string

      constructor(agentDir: string) {
        this.agentDir = agentDir
      }

      get(cwd: string) {
        return typeof decision === 'object' && decision !== null
          ? (decision[cwd] ?? null)
          : decision
      }

      set() {
        // Not needed for resolver tests.
      }
    }
  }

  it('trusts projects with no trust inputs', () => {
    expect(
      resolveRuntimeProjectTrust({
        ProjectTrustStore: createTrustStoreFactory(false),
        agentDir: '/agent',
        cwd: '/repo',
        hasProjectTrustInputs: () => false,
      }),
    ).toBe(true)
  })

  it('uses stored project trust decisions', () => {
    expect(
      resolveRuntimeProjectTrust({
        ProjectTrustStore: createTrustStoreFactory(true),
        agentDir: '/agent',
        cwd: '/repo',
        hasProjectTrustInputs: () => true,
      }),
    ).toBe(true)

    expect(
      resolveRuntimeProjectTrust({
        ProjectTrustStore: createTrustStoreFactory(false),
        agentDir: '/agent',
        cwd: '/repo',
        hasProjectTrustInputs: () => true,
      }),
    ).toBe(false)
  })

  it('keeps unknown projects untrusted until UI records a decision', () => {
    expect(
      resolveRuntimeProjectTrust({
        ProjectTrustStore: createTrustStoreFactory(null),
        agentDir: '/agent',
        cwd: '/repo',
        hasProjectTrustInputs: () => true,
      }),
    ).toBe(false)
  })

  it('uses trusted ancestor decisions', () => {
    expect(
      resolveRuntimeProjectTrust({
        ProjectTrustStore: createTrustStoreFactory({ '/home/igorw': true }),
        agentDir: '/agent',
        cwd: '/home/igorw/Work/howcode',
        hasProjectTrustInputs: () => true,
      }),
    ).toBe(true)
  })
})
