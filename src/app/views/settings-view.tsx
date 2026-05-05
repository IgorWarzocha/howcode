import { Info, Search, X } from 'lucide-react'
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Tooltip } from '../components/common/tooltip'
import { ViewHeader } from '../components/common/view-header'
import { ViewShell } from '../components/common/view-shell'
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
import { settingsSectionClass } from '../ui/classes'
import { cn } from '../utils/cn'
import { settingsHelpRowClass } from './settings/settingsClasses'
import { buildSettingsDescriptors } from './settings/settingsDescriptors'
import { normalizeManagedDictationModelId } from './settings/settingsDictationHelpers'
import {
  filterSettings,
  groupSettingsByCategory,
  settingsCategories,
} from './settings/settingsGroups'
import type { SettingsCategoryId } from './settings/settingsTypes'
import { SettingRow } from './settings/settingsUi'
import { useSettingsController } from './settings/useSettingsController'

type SettingsViewProps = {
  appSettings: AppSettings
  piSettings: PiSettings
  piTheme: PiThemeState | null
  availableModels: ComposerModel[]
  availableThinkingLevels: ComposerThinkingLevel[]
  currentModel: ComposerModel | null
  projects: Project[]
  onAction: DesktopActionInvoker
  onClose: () => void
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
  onAction,
  onClose,
}: SettingsViewProps) {
  const controller = useSettingsController({ appSettings, projects, onAction })
  const [draftPiSettings, setDraftPiSettings] = useState(piSettings)
  const piSettingsRef = useRef(piSettings)
  const draftPiSettingsRef = useRef(draftPiSettings)
  const settingsScrollRef = useRef<HTMLDivElement>(null)
  const dirtyPiSettingsRef = useRef(new Set<keyof PiSettings>())
  const themeUpdateQueueRef = useRef<Promise<unknown>>(Promise.resolve())
  const pendingThemeRef = useRef<string | null>(null)
  const [filter, setFilter] = useState('')
  const [activeCategory, setActiveCategory] = useState<SettingsCategoryId | null>(null)
  const [openSelectId, setOpenSelectId] = useState<string | null>(null)
  const [dictationModelDraft, setDictationModelDraft] = useState<DictationModelId | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [helpColumnAvailable, setHelpColumnAvailable] = useState(false)
  const [settingRowHeights, setSettingRowHeights] = useState<Record<string, number>>({})
  const normalizedFilter = filter.trim().toLowerCase()

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
    for (const key of dirtyKeys) {
      await onAction('pi-settings.update', {
        piSettingsKey: key,
        value: snapshot[key],
      })
    }
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

  const configuredDictationModelId = normalizeManagedDictationModelId(appSettings.dictationModelId)
  useEffect(() => {
    setDictationModelDraft(configuredDictationModelId)
  }, [configuredDictationModelId])

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

  return (
    <ViewShell
      className="h-full content-stretch grid-rows-[auto_minmax(0,1fr)] overflow-hidden !pb-0"
      maxWidthClassName={showHelp ? 'max-w-[1360px]' : 'max-w-[1120px]'}
    >
      <div className="grid min-w-0 items-center gap-4 lg:grid-cols-[220px_minmax(0,1fr)_auto]">
        <ViewHeader title="App settings" className="items-center" />
        <div className="hidden h-10 items-center lg:flex">
          <label className="relative block w-[min(460px,42vw)]">
            <Search
              size={15}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[color:var(--muted)]"
            />
            <input
              type="search"
              value={filter}
              onChange={(event) => setFilter(event.currentTarget.value)}
              className="h-10 w-full min-w-0 flex-1 rounded-xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.055)] px-3 py-2 pl-9 text-[13px] text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted)]"
              placeholder="Search…"
              aria-label="Search settings"
            />
          </label>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Tooltip
            content={
              helpColumnAvailable
                ? showHelp
                  ? 'Hide setting descriptions'
                  : 'Show setting descriptions'
                : 'Window is too small for the help column. Hover settings to see tooltips instead.'
            }
            placement="left"
          >
            <button
              type="button"
              className={cn(
                'inline-flex h-8 w-8 items-center justify-center self-center rounded-full border border-[color:var(--border)] bg-[rgba(255,255,255,0.03)] text-[color:var(--text)] transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.07)] disabled:cursor-not-allowed disabled:opacity-40',
                showHelp && 'border-[color:var(--accent-border)] bg-[color:var(--accent-bg)]',
              )}
              onClick={() => setShowHelp((current) => !current)}
              aria-label={showHelp ? 'Hide setting descriptions' : 'Show setting descriptions'}
              aria-pressed={showHelp}
              disabled={!helpColumnAvailable}
            >
              <Info size={14} />
            </button>
          </Tooltip>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center self-center rounded-full border border-[color:var(--border)] bg-[rgba(255,255,255,0.03)] text-[color:var(--text)] transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.07)]"
            onClick={closeSettings}
            aria-label="Close app settings"
            data-tooltip="Close app settings"
            data-tooltip-placement="left"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div
        className={cn(
          'grid h-full min-h-0 min-w-0 items-start gap-4 overflow-hidden lg:grid-cols-[220px_minmax(0,1fr)]',
          showHelp && 'lg:grid-cols-[220px_minmax(0,1fr)_minmax(18rem,24rem)]',
        )}
      >
        <nav className="sticky top-0 hidden max-h-full overflow-y-auto rounded-[22px] border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] p-2 lg:grid">
          <button
            type="button"
            className={cn(
              'flex h-10 items-center rounded-xl px-3 text-left text-[12px] transition-colors active:scale-[0.96]',
              activeCategory === null && !normalizedFilter
                ? 'bg-[color:var(--accent-bg)] text-[color:var(--text)]'
                : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]',
            )}
            onClick={() => setActiveCategory(null)}
          >
            All settings
          </button>
          {settingsCategories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={cn(
                'flex h-10 items-center rounded-xl px-3 text-left text-[12px] transition-colors active:scale-[0.96]',
                activeCategory === category.id && !normalizedFilter
                  ? 'bg-[color:var(--accent-bg)] text-[color:var(--text)]'
                  : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]',
              )}
              onClick={() => setActiveCategory(category.id)}
            >
              {category.label}
            </button>
          ))}
        </nav>

        <div
          ref={settingsScrollRef}
          className={cn(
            'grid h-full min-h-0 min-w-0 content-start gap-4 overflow-x-hidden overflow-y-auto pr-1 pb-6',
            showHelp && 'lg:col-span-2 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] lg:gap-x-4',
          )}
        >
          <div className="grid min-w-0 content-start gap-4 lg:hidden">
            <label className="relative block lg:hidden">
              <Search
                size={15}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[color:var(--muted)]"
              />
              <input
                type="search"
                value={filter}
                onChange={(event) => setFilter(event.currentTarget.value)}
                className="h-10 w-full min-w-0 flex-1 rounded-xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.055)] px-3 py-2 pl-9 text-[13px] text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted)]"
                placeholder="Search…"
                aria-label="Search settings"
              />
            </label>

            <div className="flex flex-wrap items-center gap-1.5 lg:hidden">
              <button
                type="button"
                className={cn(
                  'rounded-full border border-[color:var(--border)] px-3 py-1.5 text-[12px] transition-colors',
                  activeCategory === null && 'bg-[color:var(--accent-bg)] text-[color:var(--text)]',
                )}
                onClick={() => setActiveCategory(null)}
              >
                All
              </button>
              {settingsCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={cn(
                    'rounded-full border border-[color:var(--border)] px-3 py-1.5 text-[12px] text-[color:var(--muted)] transition-colors',
                    activeCategory === category.id &&
                      'bg-[color:var(--accent-bg)] text-[color:var(--text)]',
                  )}
                  onClick={() => setActiveCategory(category.id)}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>

          {visibleGroups.length > 0 ? (
            visibleGroups.map((group) => (
              <Fragment key={group.id}>
                <section className={cn(settingsSectionClass, 'min-w-0 gap-1 p-2.5')}>
                  <div className="flex items-baseline justify-between gap-3 px-1 pt-1 pb-1">
                    <h2 className="text-[15px] font-semibold text-[color:var(--text)]">
                      {group.label}
                    </h2>
                  </div>
                  <div className="grid">
                    {group.settings.map((setting) => (
                      <SettingRow key={setting.id} setting={setting} showHelp={showHelp} />
                    ))}
                  </div>
                </section>
                {showHelp ? (
                  <aside className="hidden min-w-0 content-start gap-1 rounded-[18px] border border-transparent p-2.5 lg:grid">
                    <div
                      className="flex items-baseline justify-between gap-3 px-1 pt-1 pb-1"
                      aria-hidden="true"
                    >
                      <h2 className="invisible text-[15px] font-semibold">{group.label}</h2>
                    </div>
                    <div className="grid">
                      {group.settings.map((setting) => (
                        <div
                          key={setting.id}
                          className={settingsHelpRowClass}
                          style={
                            settingRowHeights[setting.id]
                              ? { height: `${settingRowHeights[setting.id]}px` }
                              : undefined
                          }
                        >
                          <span className="relative top-[10px] truncate">
                            {setting.description}
                          </span>
                        </div>
                      ))}
                    </div>
                  </aside>
                ) : null}
              </Fragment>
            ))
          ) : (
            <div className="rounded-[22px] border border-[rgba(169,178,215,0.12)] bg-[rgba(255,255,255,0.025)] p-8 text-center lg:col-span-full">
              <div className="text-[14px] text-[color:var(--text)]">No matching settings</div>
              <div className="mt-1 text-[12px] text-[color:var(--muted)]">
                Try a broader term like “Pi”, “model”, “folder”, or “voice”.
              </div>
            </div>
          )}
        </div>
      </div>
    </ViewShell>
  )
}
