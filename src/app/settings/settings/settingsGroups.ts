import type { SettingDescriptor, SettingsCategory, SettingsCategoryId } from './settingsTypes'

export const settingsCategories: SettingsCategory[] = [
  { id: 'howcode', label: 'Howcode' },
  { id: 'composer', label: 'Composer' },
  { id: 'extensions', label: 'Extensions' },
  { id: 'models', label: 'Models' },
  { id: 'git-diffs', label: 'Git & Diffs' },
  { id: 'pi', label: 'Pi' },
  { id: 'shortcuts', label: 'Shortcuts' },
  { id: 'dictation', label: 'Dictation' },
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
    return `${categoryLabel} ${setting.title} ${setting.description} ${setting.keywords ?? ''}`
      .toLowerCase()
      .includes(normalizedFilter)
  })
}

export function groupSettingsByCategory({
  settings,
  categories = settingsCategories,
}: {
  settings: SettingDescriptor[]
  categories?: SettingsCategory[]
}) {
  return categories
    .map((category) => ({
      ...category,
      settings: settings.filter((setting) => setting.category === category.id),
    }))
    .filter((group) => group.settings.length > 0)
}
