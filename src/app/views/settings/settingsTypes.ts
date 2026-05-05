import type { ReactNode } from 'react'

export type SettingsCategoryId = 'models' | 'pi-runtime' | 'pi-tui' | 'projects' | 'dictation'

export type SettingDescriptor = {
  id: string
  category: SettingsCategoryId
  title: string
  description: string
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
