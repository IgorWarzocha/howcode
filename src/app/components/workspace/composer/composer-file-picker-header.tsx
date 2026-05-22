import { ChevronLeft, Home, Search } from 'lucide-react'
import type { RefObject } from 'react'
import type { ComposerFilePickerState } from '../../../desktop/types'
import { appToneMutedClass, appToneTextClass, appTypeMetaClass } from '../../../ui/classes'
import { cn } from '../../../utils/cn'
import type { ComposerFilePickerRootOption } from './composer-file-picker-utils'

type ComposerFilePickerHeaderProps = {
  picker: ComposerFilePickerState | null
  projectRootPath: string
  rootOptions: ComposerFilePickerRootOption[]
  searchExpanded: boolean
  searchInputRef: RefObject<HTMLInputElement | null>
  searchQuery: string
  onOpenDirectory: (path: string) => void
  onOpenRoot: (path: string) => void
  onSearchExpandedChange: (expanded: boolean) => void
  onSearchQueryChange: (query: string) => void
}

export function ComposerFilePickerHeader({
  picker,
  projectRootPath,
  rootOptions,
  searchExpanded,
  searchInputRef,
  searchQuery,
  onOpenDirectory,
  onOpenRoot,
  onSearchExpandedChange,
  onSearchQueryChange,
}: ComposerFilePickerHeaderProps) {
  return (
    <div className="flex h-10 min-w-0 items-center justify-between gap-2 overflow-hidden border-b border-[color:var(--border)] px-2.5 py-1.5">
      <div className="flex min-w-0 items-center gap-1 overflow-hidden">
        {picker?.parentPath ? (
          <button
            type="button"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[color:var(--muted)] transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]"
            onClick={() => onOpenDirectory(picker.parentPath ?? projectRootPath)}
            aria-label="Go up"
            data-tooltip="Go up"
          >
            <ChevronLeft size={13} />
          </button>
        ) : null}

        {rootOptions.map((rootOption) => (
          <button
            key={rootOption.path}
            type="button"
            className={cn(
              rootOption.iconOnly
                ? 'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[color:var(--muted)] transition-colors'
                : `inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-2 transition-colors ${appTypeMetaClass} ${appToneMutedClass}`,
              picker?.rootPath === rootOption.path
                ? 'bg-[color:var(--surface-hover)] text-[color:var(--text)]'
                : 'hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]',
            )}
            onClick={() => onOpenRoot(rootOption.path)}
            aria-label={`Open ${rootOption.label}`}
            data-tooltip="Open root"
          >
            {rootOption.iconOnly ? <Home size={13} /> : rootOption.label}
          </button>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {searchExpanded || searchQuery.length > 0 ? (
          <label className="relative shrink-0">
            <Search
              size={12}
              className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-[color:var(--muted)]"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              onBlur={() => {
                if (searchQuery.trim().length === 0) {
                  onSearchExpandedChange(false)
                }
              }}
              placeholder="Search files"
              className={cn(
                'h-6 w-40 rounded-md border-0 bg-[color:var(--surface-hover)] pr-2 pl-7 outline-none placeholder:text-[color:var(--muted)]',
                appTypeMetaClass,
                appToneTextClass,
              )}
              aria-label="Search files"
            />
          </label>
        ) : (
          <button
            type="button"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[color:var(--muted)] transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]"
            onClick={() => onSearchExpandedChange(true)}
            aria-label="Search files"
            data-tooltip="Search files"
          >
            <Search size={13} />
          </button>
        )}
      </div>
    </div>
  )
}
