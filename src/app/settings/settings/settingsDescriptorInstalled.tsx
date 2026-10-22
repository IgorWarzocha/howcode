import { useContext } from 'react'
import { RendererHostsContext } from '../../component-system/installed-renderer-context'
import { RendererSlot } from '../../component-system/renderer-slots'
import { settingsCategories } from './settingsGroups'
import type { SettingDescriptor, SettingsCategory } from './settingsTypes'

export function useInstalledSettingsDescriptors() {
  const renderers = useContext(RendererHostsContext)
  const categories: SettingsCategory[] = [...settingsCategories]
  const settings: SettingDescriptor[] = []
  for (const renderer of renderers) {
    const contribution = renderer.contribution.settings
    if (!contribution?.placement) continue
    const category =
      contribution.placement === 'tab'
        ? (`component:${renderer.name}` as const)
        : contribution.placement
    if (contribution.placement === 'tab')
      categories.push({ id: category, label: contribution.label })
    const Content = contribution.Content
    settings.push({
      id: `component:${renderer.name}`,
      category,
      title: contribution.label,
      description: contribution.description,
      keywords: contribution.keywords ?? '',
      layout: 'rows',
      render: () => (
        <RendererSlot key={renderer.reference?.revision} name={renderer.name}>
          <Content host={renderer.host} />
        </RendererSlot>
      ),
    })
  }
  return { categories, settings }
}
