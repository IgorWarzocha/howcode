import { Check, ChevronDown, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Tooltip } from '../../components/common/tooltip'
import {
  appToneMutedClass,
  appToneTextClass,
  appTypeControlNormalClass,
  appTypeMetaClass,
  appTypeSmallClass,
  composerPopoverInputClass,
  composerPopoverOptionClass,
  composerPopoverOptionSelectedClass,
  composerTextActionButtonClass,
  quietCheckboxCheckedClass,
  quietCheckboxClass,
  settingsPopoverPanelClass,
} from '../../ui/classes'
import { cn } from '../../utils/cn'
import { settingRowClass } from './settingsClasses'
import type { InlineSelectOption, SettingDescriptor } from './settingsTypes'

export function ToggleBox({
  checked,
  label,
  onClick,
}: {
  checked: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={cn(
        quietCheckboxClass,
        checked && quietCheckboxCheckedClass,
        'active:scale-[0.96]',
      )}
      onClick={onClick}
      aria-label={label}
      aria-pressed={checked}
    >
      <Check size={13} className={checked ? 'opacity-100' : 'opacity-0'} />
    </button>
  )
}

export function SettingRow({
  setting,
  showHelp,
}: {
  setting: SettingDescriptor
  showHelp: boolean
}) {
  const title = (
    <div className={`min-w-0 truncate ${appTypeSmallClass} ${appToneTextClass}`}>
      {setting.title}
    </div>
  )
  const control = <div className="min-w-0 max-w-full">{setting.render()}</div>

  return (
    <div className={settingRowClass} data-setting-id={setting.id}>
      {showHelp ? (
        title
      ) : (
        <Tooltip
          content={setting.description}
          delayMs={1000}
          className="block min-w-0"
          tabIndex={0}
        >
          {title}
        </Tooltip>
      )}
      <div className="min-w-0 max-w-full justify-self-stretch sm:justify-self-end">{control}</div>
    </div>
  )
}

export function InlineSelect({
  id,
  value,
  options,
  open,
  className,
  menuAlign = 'left',
  onChange,
  onOpenChange,
}: {
  id: string
  value: string
  options: InlineSelectOption[]
  open: boolean
  className?: string
  menuAlign?: 'left' | 'right'
  onChange: (value: string) => void
  onOpenChange: (open: boolean) => void
}) {
  const [search, setSearch] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const selectedOption = options.find((option) => option.value === value) ?? options[0] ?? null
  const showSearch = options.length > 12
  const normalizedSearch = search.trim().toLowerCase()
  const visibleOptions = useMemo(() => {
    if (!normalizedSearch) {
      return options
    }

    return options.filter((option) =>
      `${option.label} ${option.value} ${option.description ?? ''}`
        .toLowerCase()
        .includes(normalizedSearch),
    )
  }, [normalizedSearch, options])
  const compactOptionClass = cn(
    composerPopoverOptionClass,
    `grid-cols-[minmax(0,1fr)] py-1 ${appTypeMetaClass} ${appToneTextClass}`,
  )

  useEffect(() => {
    if (!open) {
      setSearch('')
      return
    }

    if (showSearch) {
      searchInputRef.current?.focus()
    }
  }, [open, showSearch])

  return (
    <span
      className={cn(`relative block w-52 max-w-full ${appTypeSmallClass}`, className)}
      data-inline-select-root
      data-inline-select-open={open ? 'true' : undefined}
    >
      <button
        type="button"
        className={cn(
          composerTextActionButtonClass,
          `grid h-8 w-full grid-cols-[minmax(0,1fr)_auto] justify-start gap-2 rounded-lg px-2.5 pr-8 text-left ${appTypeControlNormalClass}`,
          open && 'border-[color:var(--accent-border)] bg-[color:var(--accent-bg-subtle)]',
        )}
        onClick={() => {
          if (open) {
            setSearch('')
          }
          onOpenChange(!open)
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`${id}-menu`}
      >
        <span className={`min-w-0 truncate ${appTypeSmallClass} ${appToneTextClass}`}>
          {selectedOption?.label ?? 'Select'}
        </span>
      </button>
      <ChevronDown
        size={14}
        className={cn(
          'pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[color:var(--muted)] transition-transform',
          open && 'rotate-180',
        )}
      />
      {open ? (
        <div
          id={`${id}-menu`}
          className={cn(
            settingsPopoverPanelClass,
            'absolute top-[calc(100%+6px)] z-[60] grid max-h-64 min-w-full overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-gutter:stable]',
            showSearch ? 'w-[min(19rem,calc(100vw-2rem))]' : 'w-full',
            menuAlign === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {showSearch ? (
            <label className="relative mb-1 block">
              <Search
                size={13}
                className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[color:var(--muted)]"
              />
              <input
                ref={searchInputRef}
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                className={cn(
                  composerPopoverInputClass,
                  `w-full pl-8 ${appTypeSmallClass} ${appToneTextClass}`,
                )}
                placeholder={`Search ${options.length} options…`}
                aria-label="Search options"
              />
            </label>
          ) : null}
          {visibleOptions.length > 0 ? (
            <div role="menu" className="grid min-w-0 overflow-x-hidden">
              {visibleOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={option.value === value}
                  className={cn(
                    compactOptionClass,
                    option.value === value && composerPopoverOptionSelectedClass,
                  )}
                  onClick={() => {
                    onChange(option.value)
                    setSearch('')
                    onOpenChange(false)
                  }}
                >
                  <span className="grid min-w-0 max-w-full overflow-hidden">
                    <span className={`block truncate ${appTypeSmallClass}`}>{option.label}</span>
                    {option.description ? (
                      <span className={`block truncate ${appTypeMetaClass} ${appToneMutedClass}`}>
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className={`px-2 py-3 ${appTypeSmallClass} ${appToneMutedClass}`}>No matches</div>
          )}
        </div>
      ) : null}
    </span>
  )
}
