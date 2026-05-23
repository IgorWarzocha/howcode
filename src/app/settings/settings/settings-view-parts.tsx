import { Info, Search, X } from 'lucide-react'
import { Fragment } from 'react'
import { PopoverBoundary } from '../../components/common/popover'
import { Tooltip } from '../../components/common/tooltip'
import type { AppSettings } from '../../desktop/types'
import {
  appToneMutedClass,
  appToneTextClass,
  appTypeBodyClass,
  appTypeControlClass,
  appTypeMetaClass,
  appTypeSectionTitleClass,
  appTypeSmallClass,
  inlineEmptyNoteClass,
  quietSearchInputClass,
  viewCloseButtonClass,
} from '../../ui/classes'
import { cn } from '../../utils/cn'
import { settingsHelpRowClass } from './settingsClasses'
import { settingsCategories } from './settingsGroups'
import type { SettingsCategoryId } from './settingsTypes'
import { SettingRow } from './settingsUi'

type VisibleSettingsGroup = (typeof settingsCategories)[number] & {
  settings: Parameters<typeof SettingRow>[0]['setting'][]
}

export function DevBranchToggle({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <label
      className={`mt-2 flex min-h-8 cursor-pointer items-center justify-between gap-2 px-3 ${appTypeSmallClass} ${appToneMutedClass} transition-colors hover:text-[color:var(--text)]`}
    >
      <span className="min-w-0 truncate">Dev branch</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="h-3.5 w-3.5 shrink-0 accent-[color:var(--accent)]"
      />
    </label>
  )
}

export function SettingsSearchField({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <label className={cn('relative block', className)}>
      <Search
        size={15}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[color:var(--muted)]"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className={cn(quietSearchInputClass, `h-9 pl-9 ${appTypeControlClass} ${appToneTextClass}`)}
        placeholder="Search…"
        aria-label="Search settings"
      />
    </label>
  )
}

export function SettingsHeaderActions({
  helpColumnAvailable,
  showHelp,
  onToggleHelp,
  onClose,
}: {
  helpColumnAvailable: boolean
  showHelp: boolean
  onToggleHelp: () => void
  onClose: () => void
}) {
  return (
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
            viewCloseButtonClass,
            'self-center disabled:cursor-not-allowed disabled:opacity-40',
            showHelp && 'bg-[color:var(--surface-hover)] text-[color:var(--text)] opacity-100',
          )}
          onClick={onToggleHelp}
          aria-label={showHelp ? 'Hide setting descriptions' : 'Show setting descriptions'}
          aria-pressed={showHelp}
          disabled={!helpColumnAvailable}
        >
          <Info size={14} />
        </button>
      </Tooltip>
      <button
        type="button"
        className={cn(viewCloseButtonClass, 'self-center')}
        onClick={onClose}
        aria-label="Close app settings"
        data-tooltip="Close app settings"
        data-tooltip-placement="left"
      >
        <X size={14} />
      </button>
    </div>
  )
}

export function SettingsCategorySidebar({
  activeCategory,
  normalizedFilter,
  appSettings,
  onSelectCategory,
  onToggleDevBranch,
}: {
  activeCategory: SettingsCategoryId | null
  normalizedFilter: string
  appSettings: AppSettings
  onSelectCategory: (category: SettingsCategoryId | null) => void
  onToggleDevBranch: () => void
}) {
  return (
    <div className="sticky top-0 hidden max-h-full min-w-0 overflow-y-auto lg:grid">
      <nav className="grid gap-0.5 p-1">
        <button
          type="button"
          className={cn(
            `flex h-8 items-center rounded-md px-2 text-left ${appTypeSmallClass} transition-colors active:scale-[0.98]`,
            activeCategory === null && !normalizedFilter
              ? 'bg-[color:var(--accent-bg)] text-[color:var(--text)]'
              : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]',
          )}
          onClick={() => onSelectCategory(null)}
        >
          All settings
        </button>
        {settingsCategories.map((category) => (
          <button
            key={category.id}
            type="button"
            className={cn(
              `flex h-8 items-center rounded-md px-2 text-left ${appTypeSmallClass} transition-colors active:scale-[0.98]`,
              activeCategory === category.id && !normalizedFilter
                ? 'bg-[color:var(--accent-bg)] text-[color:var(--text)]'
                : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]',
            )}
            onClick={() => onSelectCategory(category.id)}
          >
            {category.label}
          </button>
        ))}
      </nav>
      <DevBranchToggle checked={appSettings.devUpdateBranch} onToggle={onToggleDevBranch} />
    </div>
  )
}

export function SettingsMobileFilters({
  filter,
  activeCategory,
  appSettings,
  onFilterChange,
  onSelectCategory,
  onToggleDevBranch,
}: {
  filter: string
  activeCategory: SettingsCategoryId | null
  appSettings: AppSettings
  onFilterChange: (value: string) => void
  onSelectCategory: (category: SettingsCategoryId | null) => void
  onToggleDevBranch: () => void
}) {
  return (
    <div className="grid min-w-0 content-start gap-4 lg:hidden">
      <SettingsSearchField value={filter} onChange={onFilterChange} className="lg:hidden" />
      <div className="flex flex-wrap items-center gap-1.5 lg:hidden">
        <button
          type="button"
          className={cn(
            `rounded-md px-2 py-1 ${appTypeSmallClass} transition-colors`,
            activeCategory === null && 'bg-[color:var(--accent-bg)] text-[color:var(--text)]',
          )}
          onClick={() => onSelectCategory(null)}
        >
          All
        </button>
        {settingsCategories.map((category) => (
          <button
            key={category.id}
            type="button"
            className={cn(
              `rounded-md px-2 py-1 ${appTypeSmallClass} ${appToneMutedClass} transition-colors hover:bg-[color:var(--surface-hover)]`,
              activeCategory === category.id &&
                'bg-[color:var(--accent-bg)] text-[color:var(--text)]',
            )}
            onClick={() => onSelectCategory(category.id)}
          >
            {category.label}
          </button>
        ))}
        <DevBranchToggle checked={appSettings.devUpdateBranch} onToggle={onToggleDevBranch} />
      </div>
    </div>
  )
}

function getCategoryHelpIntro(categoryId: SettingsCategoryId) {
  if (categoryId !== 'keybindings') return null
  return 'Shortcuts require at least one modifier — Ctrl, Shift, Alt, or Command — plus one key.'
}

export function SettingsGroupsList({
  visibleGroups,
  showHelp,
  highlightedCategoryId,
  settingRowHeights,
}: {
  visibleGroups: VisibleSettingsGroup[]
  showHelp: boolean
  highlightedCategoryId: SettingsCategoryId | null
  settingRowHeights: Record<string, number>
}) {
  if (visibleGroups.length === 0) {
    return (
      <div className={cn(inlineEmptyNoteClass, 'lg:col-span-full')}>
        <div className={`${appTypeBodyClass} ${appToneTextClass}`}>No matching settings</div>
        <div className={`mt-1 ${appTypeSmallClass} ${appToneMutedClass}`}>
          Try a broader term like “Pi”, “model”, “folder”, or “voice”.
        </div>
      </div>
    )
  }

  return visibleGroups.map((group) => (
    <Fragment key={group.id}>
      <PopoverBoundary
        as="section"
        className="motion-surface-pulse motion-settings-section-pulse grid min-w-0 gap-1"
        data-pulse-active={group.id === highlightedCategoryId ? 'true' : 'false'}
      >
        <div
          className={cn(
            'flex items-baseline justify-between gap-3 px-1 pt-1 pb-1',
            getCategoryHelpIntro(group.id) && 'min-h-10 items-start',
          )}
        >
          <h2 className={`${appTypeSectionTitleClass} ${appToneTextClass}`}>{group.label}</h2>
        </div>
        <div className="grid">
          {group.settings.map((setting) => (
            <SettingRow key={setting.id} setting={setting} showHelp={showHelp} />
          ))}
        </div>
      </PopoverBoundary>
      {showHelp ? (
        <aside className="hidden min-w-0 content-start gap-1 rounded-[18px] border border-transparent p-2.5 lg:grid">
          <div
            className={cn(
              'flex items-baseline gap-3 px-1 pt-1 pb-1',
              getCategoryHelpIntro(group.id) && 'min-h-10 items-start',
            )}
          >
            {getCategoryHelpIntro(group.id) ? (
              <span className={`min-w-0 ${appTypeMetaClass} text-wrap ${appToneMutedClass}`}>
                {getCategoryHelpIntro(group.id)}
              </span>
            ) : (
              <h2 className={`invisible ${appTypeSectionTitleClass}`}>{group.label}</h2>
            )}
          </div>
          <div className="grid min-w-0">
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
                  {setting.helpDescription ?? setting.description}
                </span>
              </div>
            ))}
          </div>
        </aside>
      ) : null}
    </Fragment>
  ))
}
