import type { SettingsCategoryId } from '@howaboua/howcode-sdk/settings-navigation'
import type { ReactNode } from 'react'

export type {
  SettingsCategoryId,
  SettingsOpenTarget,
} from '@howaboua/howcode-sdk/settings-navigation'

export type SettingDescriptor = {
  id: string
  category: SettingsCategoryId
  componentId?: string
  title: string
  description: string
  helpDescription?: string
  dividerBefore?: boolean
  keywords?: string
  render: () => ReactNode
}

export type SettingsCategory = {
  id: SettingsCategoryId
  label: string
}
