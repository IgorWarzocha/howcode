import { type Dispatch, type SetStateAction, useCallback, useRef, useState } from 'react'
import { ViewHeader } from '../common/view-header'
import { ViewShell } from '../common/view-shell'
import type {
  AppSettings,
  ComposerModel,
  ComposerThinkingLevel,
  DesktopActionInvoker,
  DictationModelId,
  PiSettings,
  PiThemeState,
} from '../desktop/types'
import { cn } from '../utils/cn'
import { buildSettingsDescriptors } from './settings/settingsDescriptors'
import { normalizeManagedDictationModelId } from './settings/settingsDictationHelpers'
import { filterSettings, groupSettingsByCategory } from './settings/settingsGroups'
import { SettingsGroupsList } from './settings/settingsGroupsList'
import {
  SettingsCategorySidebar,
  SettingsHeaderActions,
  SettingsMobileFilters,
  SettingsSearchField,
} from './settings/settingsNavigation'
import type { SettingsOpenTarget } from './settings/settingsTypes'
import { useDraftPiSettings } from './settings/useDraftPiSettings'
import { useSettingsController } from './settings/useSettingsController'
import { useSettingsHelpLayout } from './settings/useSettingsHelpLayout'
import { useSettingsNavigation } from './settings/useSettingsNavigation'

type SettingsViewProps = {
  appSettings: AppSettings
  piSettings: PiSettings
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
  piSettings,
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
  const piDraft = useDraftPiSettings({ onAction, piSettings })
  const navigation = useSettingsNavigation({ openTarget, settingsScrollRef })
  const configuredDictationModelId = normalizeManagedDictationModelId(appSettings.dictationModelId)
  const [dictationModelEdit, setDictationModelEdit] = useState<{
    source: DictationModelId | null
    value: DictationModelId | null
  } | null>(null)
  const dictationModelDraft =
    dictationModelEdit?.source === configuredDictationModelId
      ? dictationModelEdit.value
      : configuredDictationModelId
  const setDictationModelDraft: Dispatch<SetStateAction<DictationModelId | null>> = useCallback(
    (value) => {
      setDictationModelEdit((current) => {
        const currentValue =
          current?.source === configuredDictationModelId
            ? current.value
            : configuredDictationModelId
        return {
          source: configuredDictationModelId,
          value: typeof value === 'function' ? value(currentValue) : value,
        }
      })
    },
    [configuredDictationModelId],
  )

  const settings = buildSettingsDescriptors({
    appSettings,
    availableModels,
    availableThinkingLevels,
    currentModel,
    controller,
    draftPiSettings: piDraft.draftPiSettings,
    piTheme,
    setDraftPiSetting: piDraft.setDraftPiSetting,
    openSelectId: navigation.openSelectId,
    setOpenSelectId: navigation.setOpenSelectId,
    dictationModelDraft,
    setDictationModelDraft,
    configuredDictationModelId,
    onAction,
  })
  const filteredSettings = filterSettings({
    settings,
    normalizedFilter: navigation.normalizedFilter,
    activeCategory: navigation.activeCategory,
  })
  const visibleGroups = groupSettingsByCategory({ settings: filteredSettings })
  const help = useSettingsHelpLayout({
    settingsScrollRef,
    visibleSettingIds: filteredSettings.map((setting) => setting.id).join('|'),
  })
  const closeSettings = useCallback(
    () => void piDraft.flushPiSettings().finally(onClose),
    [onClose, piDraft.flushPiSettings],
  )

  return (
    <ViewShell
      className="h-full content-stretch grid-rows-[auto_minmax(0,1fr)] overflow-hidden !pb-0"
      maxWidthClassName={help.showHelp ? 'max-w-[1360px]' : 'max-w-[1120px]'}
    >
      <div className="grid min-w-0 items-center gap-4 lg:grid-cols-[220px_minmax(0,1fr)_auto]">
        <ViewHeader title="App settings" className="items-center" />
        <div className="hidden h-10 items-center lg:flex">
          <SettingsSearchField
            value={navigation.filter}
            onChange={navigation.setFilter}
            className="w-[min(460px,42vw)]"
          />
        </div>
        <SettingsHeaderActions
          helpColumnAvailable={help.helpColumnAvailable}
          showHelp={help.showHelp}
          onToggleHelp={() => help.setShowHelp((current) => !current)}
          onClose={closeSettings}
        />
      </div>

      <div
        className={cn(
          'grid h-full min-h-0 min-w-0 items-start gap-4 overflow-hidden lg:grid-cols-[220px_minmax(0,1fr)]',
          help.showHelp && 'lg:grid-cols-[220px_minmax(0,1fr)_minmax(18rem,24rem)]',
        )}
      >
        <SettingsCategorySidebar
          activeCategory={navigation.activeCategory}
          normalizedFilter={navigation.normalizedFilter}
          appSettings={appSettings}
          onSelectCategory={navigation.setActiveCategory}
          onToggleDevBranch={controller.app.toggleDevUpdateBranch}
        />

        <div
          ref={settingsScrollRef}
          className={cn(
            'grid h-full min-h-0 min-w-0 content-start gap-4 overflow-x-hidden overflow-y-auto pr-1 pb-6',
            help.showHelp &&
              'lg:col-span-2 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] lg:gap-x-4',
          )}
        >
          <SettingsMobileFilters
            filter={navigation.filter}
            activeCategory={navigation.activeCategory}
            appSettings={appSettings}
            onFilterChange={navigation.setFilter}
            onSelectCategory={navigation.setActiveCategory}
            onToggleDevBranch={controller.app.toggleDevUpdateBranch}
          />
          <SettingsGroupsList
            visibleGroups={visibleGroups}
            showHelp={help.showHelp}
            highlightedCategoryId={navigation.highlightedCategoryId}
            settingRowHeights={help.settingRowHeights}
          />
        </div>
      </div>
    </ViewShell>
  )
}
