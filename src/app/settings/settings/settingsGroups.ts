import type { SettingDescriptor, SettingsCategory, SettingsCategoryId } from './settingsTypes'

export const settingsCategories: SettingsCategory[] = [
  { id: 'general', label: 'General' },
  { id: 'chat', label: 'Chat' },
  { id: 'shortcuts', label: 'Shortcuts' },
  { id: 'components', label: 'Components' },
]

export function filterSettings({
  settings,
  categories = settingsCategories,
  normalizedFilter,
  activeCategory,
}: {
  settings: SettingDescriptor[]
  categories?: SettingsCategory[]
  normalizedFilter: string
  activeCategory: SettingsCategoryId | null
}) {
  return settings.filter((setting) => {
    if (!normalizedFilter && activeCategory && setting.category !== activeCategory) {
      return false
    }

    if (!normalizedFilter) {
      return true
    }

    const categoryLabel =
      categories.find((category) => category.id === setting.category)?.label ?? ''
    return `${categoryLabel} ${setting.section ?? ''} ${setting.title} ${setting.description} ${setting.keywords ?? ''}`
      .toLowerCase()
      .includes(normalizedFilter)
  })
}

export function groupSettingsBySection(settings: SettingDescriptor[], categoryLabel: string) {
  const sections = new Map<string, SettingDescriptor[]>()
  for (const setting of settings) {
    const label = setting.section ?? categoryLabel
    const section = sections.get(label)
    if (section) section.push(setting)
    else sections.set(label, [setting])
  }
  return [...sections].map(([label, entries]) => ({ label, settings: entries }))
}

export function groupSettingsByCategory({
  settings,
  categories = settingsCategories,
}: {
  settings: SettingDescriptor[]
  categories?: SettingsCategory[]
}) {
  return categories.flatMap((category) => {
    const group = {
      ...category,
      settings: settings.filter((setting) => setting.category === category.id),
    }
    return group.settings.length > 0 ? [group] : []
  })
}
