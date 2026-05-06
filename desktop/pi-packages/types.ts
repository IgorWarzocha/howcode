export type PiConfiguredPackageRecord = {
  resourceKind: 'package' | 'extension'
  source: string
  scope: 'user' | 'project' | 'chat'
  filtered: boolean
  installedPath?: string | undefined
  settingsPath: string
}

export type PiSettingsPackageSource =
  | string
  | {
      source: string
      extensions?: string[] | undefined
      skills?: string[] | undefined
      prompts?: string[] | undefined
      themes?: string[] | undefined
    }

export type PiSettingsManager = {
  getGlobalSettings: () => {
    packages?: PiSettingsPackageSource[]
    extensions?: string[] | undefined
  }
  getProjectSettings: () => {
    packages?: PiSettingsPackageSource[]
    extensions?: string[] | undefined
  }
}

export type PiPackageManager = {
  getInstalledPath: (source: string, scope: 'user' | 'project') => string | undefined
  installAndPersist: (source: string, options?: { local?: boolean | undefined }) => Promise<void>
  removeAndPersist: (source: string, options?: { local?: boolean | undefined }) => Promise<boolean>
}
