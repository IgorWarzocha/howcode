import { Check, ChevronDown, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Tooltip } from '../../components/common/tooltip'
import { composerTextActionButtonClass, popoverPanelClass } from '../../ui/classes'
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
      className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[color:var(--border)] bg-transparent text-[color:var(--text)] transition-colors active:scale-[0.96] hover:border-[color:var(--border-strong)]"
      onClick={onClick}
      aria-label={label}
      aria-pressed={checked}
    >
      {checked ? <Check size={13} /> : null}
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
    <div className="min-w-0 truncate text-[12px] text-[color:var(--text)]">{setting.title}</div>
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
  onChange,
  onOpenChange,
}: {
  id: string
  value: string
  options: InlineSelectOption[]
  open: boolean
  className?: string
  onChange: (value: string) => void
  onOpenChange: (open: boolean) => void
}) {
  const [search, setSearch] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const selectedOption = options.find((option) => option.value === value) ?? options[0] ?? null
  const alignMenuRight = className?.includes('justify-self-end') ?? false
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
  const compactOptionClass =
    'flex min-h-0 w-full items-center rounded-md border border-transparent px-2 py-1 text-left text-[11.5px] leading-4 text-[color:var(--text)] transition-colors hover:bg-[rgba(255,255,255,0.045)]'

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
      className={cn('relative block w-52 max-w-full text-[12px]', className)}
      data-inline-select-root
    >
      <button
        type="button"
        className={cn(
          composerTextActionButtonClass,
          'grid h-8 w-full grid-cols-[minmax(0,1fr)_auto] justify-start gap-2 rounded-lg px-2.5 pr-8 text-left font-normal',
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
        <span className="min-w-0 truncate text-[12px] text-[color:var(--text)]">
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
            popoverPanelClass,
            options.length > 10 && 'max-h-64 overflow-y-auto',
            'absolute top-[calc(100%+6px)] z-[60] grid min-w-full max-w-[calc(100vw-2rem)] overflow-x-hidden rounded-xl border p-1',
            showSearch && 'w-[26.5rem]',
            alignMenuRight ? 'right-0' : 'left-0',
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
                className="h-8 w-full rounded-lg border border-[rgba(169,178,215,0.14)] bg-[rgba(255,255,255,0.055)] px-2.5 pl-8 text-[12px] text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted)]"
                placeholder={`Search ${options.length} options…`}
                aria-label="Search options"
              />
            </label>
          ) : null}
          {visibleOptions.length > 0 ? (
            <div role="menu" className="grid min-w-0">
              {visibleOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={option.value === value}
                  className={cn(
                    compactOptionClass,
                    option.value === value && 'bg-[rgba(255,255,255,0.06)]',
                  )}
                  onClick={() => {
                    onChange(option.value)
                    setSearch('')
                    onOpenChange(false)
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] leading-4">{option.label}</span>
                    {option.description ? (
                      <span className="block truncate text-[11px] leading-3 text-[color:var(--muted)]">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-2 py-3 text-[12px] text-[color:var(--muted)]">No matches</div>
          )}
        </div>
      ) : null}
    </span>
  )
}
