import { ViewHeader } from '@howaboua/howcode-sdk/common/view-header'
import { ViewShell } from '@howaboua/howcode-sdk/common/view-shell'
import { useCallback, useRef } from 'react'
import type {
  AppSettings,
  ComposerModel,
  ComposerThinkingLevel,
  DesktopActionInvoker,
  PiThemeState,
  ShellPreferences,
} from '../desktop/types'
import { SettingsComponentCatalogue } from './settings/settingsComponentCatalogue'
import { useInstalledSettingsDescriptors } from './settings/settingsDescriptorInstalled'
import { buildSettingsDescriptors } from './settings/settingsDescriptors'
import { filterSettings, groupSettingsByCategory } from './settings/settingsGroups'
import { SettingsGroupsList } from './settings/settingsGroupsList'
import {
  SettingsCategorySidebar,
  SettingsHeaderActions,
  SettingsMobileFilters,
  SettingsSearchField,
} from './settings/settingsNavigation'
import { SettingsPiImport } from './settings/settingsPiImport'
import type { SettingsOpenTarget } from './settings/settingsTypes'
import { useDraftShellPreferences } from './settings/useDraftShellPreferences'
import { useSettingsController } from './settings/useSettingsController'
import { useSettingsNavigation } from './settings/useSettingsNavigation'
import './settings.css'

type SettingsViewProps = {
  appSettings: AppSettings
  shellPreferences: ShellPreferences
  piTheme: PiThemeState | null
  availableModels: ComposerModel[]
  availableThinkingLevels: ComposerThinkingLevel[]
  currentModel: ComposerModel | null
  resolvedPiDirectory?: string | null | undefined
  onAction: DesktopActionInvoker
  onClose: () => void
  openTarget?: SettingsOpenTarget | null | undefined
}

export function SettingsView({
  appSettings,
  shellPreferences,
  piTheme,
  availableModels,
  availableThinkingLevels,
  currentModel,
  resolvedPiDirectory,
  onAction,
  onClose,
  openTarget = null,
}: SettingsViewProps) {
  const settingsScrollRef = useRef<HTMLDivElement>(null)
  const controller = useSettingsController({ appSettings, resolvedPiDirectory, onAction })
  const preferencesDraft = useDraftShellPreferences({ onAction, shellPreferences })
  const navigation = useSettingsNavigation({ openTarget, settingsScrollRef })
  const installed = useInstalledSettingsDescriptors()

  const settings = buildSettingsDescriptors({
    appSettings,
    availableModels,
    availableThinkingLevels,
    currentModel,
    controller,
    draftShellPreferences: preferencesDraft.draftShellPreferences,
    piTheme,
    setDraftShellPreference: preferencesDraft.setDraftShellPreference,
    openSelectId: navigation.openSelectId,
    setOpenSelectId: navigation.setOpenSelectId,
    onAction,
    installedSettings: installed.settings,
  })
  settings.push({
    id: 'general.import-pi',
    category: 'general',
    section: 'Pi preferences',
    title: 'Import from Pi',
    description:
      'Copy supported preferences into Howcode. Credentials and resources are not imported; Pi files are unchanged.',
    keywords: 'import migration preferences settings',
    render: () => (
      <SettingsPiImport
        onAction={onAction}
        beforeImport={preferencesDraft.flushShellPreferences}
        defaultDirectory={resolvedPiDirectory}
      />
    ),
  })
  const filteredSettings = filterSettings({
    settings: settings.filter((setting) => setting.category !== 'components'),
    categories: installed.categories,
    normalizedFilter: navigation.normalizedFilter,
    activeCategory: navigation.activeCategory,
  })
  const visibleGroups = groupSettingsByCategory({
    settings: filteredSettings,
    categories: installed.categories,
  })
  const closeSettings = useCallback(
    () => void preferencesDraft.flushShellPreferences().finally(onClose),
    [onClose, preferencesDraft.flushShellPreferences],
  )

  return (
    <ViewShell
      className="settings-view h-full content-stretch grid-rows-[auto_minmax(0,1fr)] overflow-hidden !pb-0"
      maxWidthClassName="max-w-[1180px]"
    >
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 lg:grid-cols-[220px_minmax(0,1fr)_auto]">
        <ViewHeader title="App settings" className="items-center" />
        <div className="hidden h-10 items-center lg:flex">
          <SettingsSearchField
            value={navigation.filter}
            onChange={navigation.setFilter}
            className="w-[min(460px,42vw)]"
          />
        </div>
        <SettingsHeaderActions onClose={closeSettings} />
      </div>

      <div className="grid h-full min-h-0 min-w-0 items-start gap-4 overflow-hidden lg:grid-cols-[220px_minmax(0,1fr)]">
        <SettingsCategorySidebar
          categories={installed.categories}
          activeCategory={navigation.activeCategory}
          normalizedFilter={navigation.normalizedFilter}
          onSelectCategory={navigation.setActiveCategory}
        />

        <div
          ref={settingsScrollRef}
          className="settings-content grid h-full min-h-0 min-w-0 content-start gap-8 overflow-x-hidden overflow-y-auto pr-1 pb-6"
        >
          <SettingsMobileFilters
            categories={installed.categories}
            filter={navigation.filter}
            activeCategory={navigation.activeCategory}
            onFilterChange={navigation.setFilter}
            onSelectCategory={navigation.setActiveCategory}
          />
          {navigation.activeCategory === 'components' ? (
            <SettingsComponentCatalogue
              settings={settings}
              filter={navigation.normalizedFilter}
              target={openTarget?.componentId}
            />
          ) : (
            <SettingsGroupsList
              visibleGroups={visibleGroups}
              highlightedCategoryId={navigation.highlightedCategoryId}
            />
          )}
        </div>
      </div>
    </ViewShell>
  )
}
