import type { ReactNode } from 'react'

export type SettingsCategoryId =
  | 'models'
  | 'pi-runtime'
  | 'pi-tui'
  | 'projects'
  | 'dictation'
  | 'keybindings'

export type SettingsOpenTarget = {
  category?: SettingsCategoryId | undefined
  settingId?: string | undefined
}

export type SettingDescriptor = {
  id: string
  category: SettingsCategoryId
  title: string
  description: string
  helpDescription?: string
  keywords?: string
  render: () => ReactNode
}

export type InlineSelectOption = {
  value: string
  label: string
  description?: string | undefined
}

export type SettingsCategory = {
  id: SettingsCategoryId
  label: string
}
