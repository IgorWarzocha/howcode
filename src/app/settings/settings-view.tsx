import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
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
import type { Project } from '../types'
import { cn } from '../utils/cn'
import {
  SettingsCategorySidebar,
  SettingsGroupsList,
  SettingsHeaderActions,
  SettingsMobileFilters,
  SettingsSearchField,
} from './settings/settings-view-parts'
import { buildSettingsDescriptors } from './settings/settingsDescriptors'
import { normalizeManagedDictationModelId } from './settings/settingsDictationHelpers'
import { filterSettings, groupSettingsByCategory } from './settings/settingsGroups'
import type { SettingsCategoryId, SettingsOpenTarget } from './settings/settingsTypes'
import { useSettingsController } from './settings/useSettingsController'

const resolvedPromise = Promise.resolve()

type SettingsViewProps = {
  appSettings: AppSettings
  piSettings: PiSettings
  piTheme: PiThemeState | null
  availableModels: ComposerModel[]
  availableThinkingLevels: ComposerThinkingLevel[]
  currentModel: ComposerModel | null
  projects: Project[]
  resolvedPiDirectory?: string | null | undefined
  onAction: DesktopActionInvoker
  onClose: () => void
  openTarget?: SettingsOpenTarget | null | undefined
}

function getDatasetValue(element: HTMLElement, key: string) {
  return element.dataset[key]
}

export function SettingsView({
  appSettings,
  piSettings,
  piTheme,
  availableModels,
  availableThinkingLevels,
  currentModel,
  projects,
  resolvedPiDirectory,
  onAction,
  onClose,
  openTarget = null,
}: SettingsViewProps) {
  const controller = useSettingsController({ appSettings, projects, resolvedPiDirectory, onAction })
  const [draftPiSettings, setDraftPiSettings] = useState(piSettings)
  const piSettingsRef = useRef(piSettings)
  const draftPiSettingsRef = useRef(draftPiSettings)
  const settingsScrollRef = useRef<HTMLDivElement>(null)
  const dirtyPiSettingsRef = useRef(new Set<keyof PiSettings>())
  const themeUpdateQueueRef = useRef<Promise<unknown>>(resolvedPromise)
  const pendingThemeRef = useRef<string | null>(null)
  const [filter, setFilter] = useState('')
  const [activeCategory, setActiveCategory] = useState<SettingsCategoryId | null>(null)
  const [openSelectId, setOpenSelectId] = useState<string | null>(null)
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
  const [showHelp, setShowHelp] = useState(false)
  const [highlightedSettingId, setHighlightedSettingId] = useState<string | null>(null)
  const [highlightedCategoryId, setHighlightedCategoryId] = useState<SettingsCategoryId | null>(
    null,
  )
  const [helpColumnAvailable, setHelpColumnAvailable] = useState(false)
  const [settingRowHeights, setSettingRowHeights] = useState<Record<string, number>>({})
  const normalizedFilter = filter.trim().toLowerCase()

  useEffect(() => {
    if (!openTarget) return
    setFilter('')
    setActiveCategory(openTarget.category ?? null)
    setHighlightedSettingId(openTarget.settingId ?? null)
    setHighlightedCategoryId(openTarget.category ?? null)
  }, [openTarget])

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)')
    const updateHelpAvailability = () => {
      setHelpColumnAvailable(query.matches)
      if (!query.matches) {
        setShowHelp(false)
      }
    }

    updateHelpAvailability()
    query.addEventListener('change', updateHelpAvailability)
    return () => query.removeEventListener('change', updateHelpAvailability)
  }, [])

  const revertFailedThemeUpdate = useCallback((failedTheme: string) => {
    if (pendingThemeRef.current === failedTheme) {
      pendingThemeRef.current = null
      setDraftPiSettings((current) =>
        current.theme === failedTheme ? piSettingsRef.current : current,
      )
    }
  }, [])

  useEffect(() => {
    draftPiSettingsRef.current = draftPiSettings
  }, [draftPiSettings])

  useEffect(() => {
    piSettingsRef.current = piSettings
    if (pendingThemeRef.current === piSettings.theme) {
      pendingThemeRef.current = null
    }

    if (dirtyPiSettingsRef.current.size === 0) {
      setDraftPiSettings(
        pendingThemeRef.current ? { ...piSettings, theme: pendingThemeRef.current } : piSettings,
      )
    }
  }, [piSettings])

  const setDraftPiSetting = useCallback(
    <Key extends keyof PiSettings>(key: Key, value: PiSettings[Key]) => {
      if (key === 'theme') {
        const nextTheme = value as string
        dirtyPiSettingsRef.current.delete(key)
        pendingThemeRef.current = nextTheme
        setDraftPiSettings((current) => ({ ...current, theme: nextTheme }))
        themeUpdateQueueRef.current = themeUpdateQueueRef.current
          .catch(() => {
            // Keep later theme updates moving even if an earlier write failed.
          })
          .then(async () => {
            try {
              const result = await onAction('pi-settings.update', {
                piSettingsKey: key,
                value: nextTheme,
              })

              if (!result || result.ok === false || typeof result.result?.error === 'string') {
                revertFailedThemeUpdate(nextTheme)
              }
            } catch {
              revertFailedThemeUpdate(nextTheme)
            }
          })
        return
      }

      dirtyPiSettingsRef.current.add(key)
      setDraftPiSettings((current) => ({ ...current, [key]: value }))
    },
    [onAction, revertFailedThemeUpdate],
  )

  const flushPiSettings = useCallback(async () => {
    const dirtyKeys = [...dirtyPiSettingsRef.current]
    if (dirtyKeys.length === 0) {
      return
    }

    dirtyPiSettingsRef.current.clear()
    const snapshot = draftPiSettingsRef.current
    await dirtyKeys.reduce<Promise<void>>(
      (pending, key) =>
        pending.then(async () => {
          await onAction('pi-settings.update', {
            piSettingsKey: key,
            value: snapshot[key],
          })
        }),
      Promise.resolve(),
    )
  }, [onAction])

  useEffect(() => {
    return () => {
      void flushPiSettings()
    }
  }, [flushPiSettings])

  const closeSettings = useCallback(() => {
    void flushPiSettings().finally(onClose)
  }, [flushPiSettings, onClose])

  useEffect(() => {
    if (!openSelectId) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) {
        return
      }

      if (!target.closest('[data-inline-select-root]')) {
        setOpenSelectId(null)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setOpenSelectId(null)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [openSelectId])

  const settings = buildSettingsDescriptors({
    appSettings,
    availableModels,
    availableThinkingLevels,
    currentModel,
    controller,
    draftPiSettings,
    piTheme,
    setDraftPiSetting,
    openSelectId,
    setOpenSelectId,
    dictationModelDraft,
    setDictationModelDraft,
    configuredDictationModelId,
    onAction,
  })

  const filteredSettings = filterSettings({
    settings,
    normalizedFilter,
    activeCategory,
  })
  const visibleGroups = groupSettingsByCategory({ settings: filteredSettings })
  const visibleSettingIds = filteredSettings.map((setting) => setting.id).join('|')

  useLayoutEffect(() => {
    void visibleSettingIds
    if (!(showHelp && settingsScrollRef.current) || typeof ResizeObserver === 'undefined') {
      setSettingRowHeights((current) => (Object.keys(current).length === 0 ? current : {}))
      return
    }

    let frameId: number | null = null
    const rows = [...settingsScrollRef.current.querySelectorAll<HTMLElement>('[data-setting-id]')]
    const updateHeights = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }
      frameId = window.requestAnimationFrame(() => {
        frameId = null
        const nextHeights = Object.fromEntries(
          rows.map((row) => [getDatasetValue(row, 'settingId') ?? '', Math.ceil(row.offsetHeight)]),
        )
        setSettingRowHeights((current) => {
          const nextKeys = Object.keys(nextHeights)
          const unchanged =
            Object.keys(current).length === nextKeys.length &&
            nextKeys.every((key) => current[key] === nextHeights[key])
          return unchanged ? current : nextHeights
        })
      })
    }

    const observer = new ResizeObserver(updateHeights)
    for (const row of rows) {
      observer.observe(row)
    }
    updateHeights()
    return () => {
      observer.disconnect()
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [showHelp, visibleSettingIds])

  useEffect(() => {
    if (!highlightedSettingId) return

    const frameId = window.requestAnimationFrame(() => {
      const target = settingsScrollRef.current?.querySelector<HTMLElement>(
        `[data-setting-id="${CSS.escape(highlightedSettingId)}"]`,
      )
      target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
    const timeoutId = window.setTimeout(() => setHighlightedSettingId(null), 2200)
    return () => {
      window.cancelAnimationFrame(frameId)
      window.clearTimeout(timeoutId)
    }
  }, [highlightedSettingId])

  useEffect(() => {
    if (!highlightedCategoryId) return
    const timeoutId = window.setTimeout(() => setHighlightedCategoryId(null), 1800)
    return () => window.clearTimeout(timeoutId)
  }, [highlightedCategoryId])

  return (
    <ViewShell
      className="h-full content-stretch grid-rows-[auto_minmax(0,1fr)] overflow-hidden !pb-0"
      maxWidthClassName={showHelp ? 'max-w-[1360px]' : 'max-w-[1120px]'}
    >
      <div className="grid min-w-0 items-center gap-4 lg:grid-cols-[220px_minmax(0,1fr)_auto]">
        <ViewHeader title="App settings" className="items-center" />
        <div className="hidden h-10 items-center lg:flex">
          <SettingsSearchField
            value={filter}
            onChange={setFilter}
            className="w-[min(460px,42vw)]"
          />
        </div>
        <SettingsHeaderActions
          helpColumnAvailable={helpColumnAvailable}
          showHelp={showHelp}
          onToggleHelp={() => setShowHelp((current) => !current)}
          onClose={closeSettings}
        />
      </div>

      <div
        className={cn(
          'grid h-full min-h-0 min-w-0 items-start gap-4 overflow-hidden lg:grid-cols-[220px_minmax(0,1fr)]',
          showHelp && 'lg:grid-cols-[220px_minmax(0,1fr)_minmax(18rem,24rem)]',
        )}
      >
        <SettingsCategorySidebar
          activeCategory={activeCategory}
          normalizedFilter={normalizedFilter}
          appSettings={appSettings}
          onSelectCategory={setActiveCategory}
          onToggleDevBranch={controller.toggleDevUpdateBranch}
        />

        <div
          ref={settingsScrollRef}
          className={cn(
            'grid h-full min-h-0 min-w-0 content-start gap-4 overflow-x-hidden overflow-y-auto pr-1 pb-6',
            showHelp && 'lg:col-span-2 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] lg:gap-x-4',
          )}
        >
          <SettingsMobileFilters
            filter={filter}
            activeCategory={activeCategory}
            appSettings={appSettings}
            onFilterChange={setFilter}
            onSelectCategory={setActiveCategory}
            onToggleDevBranch={controller.toggleDevUpdateBranch}
          />

          <SettingsGroupsList
            visibleGroups={visibleGroups}
            showHelp={showHelp}
            highlightedCategoryId={highlightedCategoryId}
            settingRowHeights={settingRowHeights}
          />
        </div>
      </div>
    </ViewShell>
  )
}
