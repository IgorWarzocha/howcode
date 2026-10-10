import { Tooltip } from '@howaboua/howcode-sdk/common/tooltip'
import { Input } from '@howaboua/howcode-sdk/ui/controls'
import {
  appToneMutedClass,
  appToneTextClass,
  appTypeControlClass,
  appTypeSmallClass,
} from '@howaboua/howcode-sdk/ui/typography-scale'
import { cn } from '@howaboua/howcode-sdk/utils/cn'
import { viewCloseButtonClass } from '@howcode/ui/classes'
import { Info, Search, X } from 'lucide-react'
import { settingsCategories } from './settingsGroups'
import type { SettingsCategoryId } from './settingsTypes'

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
    <div className={cn('relative block', className)}>
      <Search
        size={15}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[color:var(--muted)]"
      />
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className={cn(`h-9 pl-9 ${appTypeControlClass} ${appToneTextClass}`)}
        placeholder="Search…"
        aria-label="Search settings"
      />
    </div>
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
  onSelectCategory,
}: {
  activeCategory: SettingsCategoryId | null
  normalizedFilter: string
  onSelectCategory: (category: SettingsCategoryId | null) => void
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
    </div>
  )
}

export function SettingsMobileFilters({
  filter,
  activeCategory,
  onFilterChange,
  onSelectCategory,
}: {
  filter: string
  activeCategory: SettingsCategoryId | null
  onFilterChange: (value: string) => void
  onSelectCategory: (category: SettingsCategoryId | null) => void
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
      </div>
    </div>
  )
}
