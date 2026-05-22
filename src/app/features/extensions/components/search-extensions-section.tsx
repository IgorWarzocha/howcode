import { PackagePlus, Search, Sparkles } from 'lucide-react'
import { DisclosureSection } from '../../../components/common/disclosure-section'
import { TextButton } from '../../../components/common/text-button'
import { Tooltip } from '../../../components/common/tooltip'
import type { PiPackageCatalogItem } from '../../../desktop/types'
import {
  appToneMutedClass,
  appTypeControlClass,
  compactRoundIconButtonClass,
  iconActionButtonDisabledClass,
  inlineEmptyNoteClass,
  quietSearchInputClass,
} from '../../../ui/classes'
import { cn } from '../../../utils/cn'
import type { InstallScope } from '../types'
import { CatalogItemRow } from './catalog-item-row'

type SearchExtensionsSectionProps = {
  open: boolean
  searchInput: string
  installScope: InstallScope
  projectScopeAvailable: boolean
  hasSelectedCatalogSources: boolean
  hasPendingInstall: boolean
  selectedCatalogSources: string[]
  catalogItems: PiPackageCatalogItem[]
  installedIdentityKeys: Set<string>
  catalogLoading: boolean
  catalogError: string | null
  hasNextCatalogPage: boolean
  isFetchingNextCatalogPage: boolean
  onToggleOpen: () => void
  onSearchInputChange: (value: string) => void
  onInstallSelected: () => void | Promise<void>
  onToggleSelectedSource: (source: string) => void
  onLoadMore: () => void
  isInstallPending: (source: string) => boolean
}

function SearchExtensionsResults({
  catalogError,
  catalogItems,
  catalogLoading,
  installedIdentityKeys,
  isInstallPending,
  onToggleSelectedSource,
  selectedCatalogSources,
}: Pick<
  SearchExtensionsSectionProps,
  | 'catalogError'
  | 'catalogItems'
  | 'catalogLoading'
  | 'installedIdentityKeys'
  | 'isInstallPending'
  | 'onToggleSelectedSource'
  | 'selectedCatalogSources'
>) {
  if (catalogLoading) {
    return <div className={inlineEmptyNoteClass}>Loading packages…</div>
  }
  if (catalogError) {
    return (
      <div className={cn(inlineEmptyNoteClass, 'text-[color:var(--danger)]')}>{catalogError}</div>
    )
  }
  if (catalogItems.length === 0) return <div className={inlineEmptyNoteClass}>No pi packages.</div>
  return (
    <div className="grid gap-2">
      {catalogItems.map((item) => (
        <CatalogItemRow
          key={item.name}
          item={item}
          selected={selectedCatalogSources.includes(item.source)}
          installed={installedIdentityKeys.has(item.identityKey)}
          pendingInstall={isInstallPending(item.source)}
          onToggleSelected={onToggleSelectedSource}
        />
      ))}
    </div>
  )
}

function SearchExtensionsLoadMore({
  hasNextCatalogPage,
  isFetchingNextCatalogPage,
  onLoadMore,
}: Pick<
  SearchExtensionsSectionProps,
  'hasNextCatalogPage' | 'isFetchingNextCatalogPage' | 'onLoadMore'
>) {
  if (!hasNextCatalogPage) return null
  return (
    <div className="flex justify-center pt-1">
      <TextButton
        className={cn(
          'rounded-lg px-3 py-1.5 hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]',
          appTypeControlClass,
          appToneMutedClass,
        )}
        onClick={onLoadMore}
        disabled={isFetchingNextCatalogPage}
      >
        {isFetchingNextCatalogPage ? 'Loading more…' : 'Load more'}
      </TextButton>
    </div>
  )
}

export function SearchExtensionsSection({
  open,
  searchInput,
  installScope,
  projectScopeAvailable,
  hasSelectedCatalogSources,
  hasPendingInstall,
  selectedCatalogSources,
  catalogItems,
  installedIdentityKeys,
  catalogLoading,
  catalogError,
  hasNextCatalogPage,
  isFetchingNextCatalogPage,
  onToggleOpen,
  onSearchInputChange,
  onInstallSelected,
  onToggleSelectedSource,
  onLoadMore,
  isInstallPending,
}: SearchExtensionsSectionProps) {
  const installDisabled =
    (!projectScopeAvailable && installScope === 'project') ||
    !hasSelectedCatalogSources ||
    hasPendingInstall

  return (
    <DisclosureSection title="Browse" open={open} onToggle={onToggleOpen}>
      {open ? (
        <>
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
            <label className="relative block min-w-0">
              <span className="pointer-events-none absolute inset-y-0 left-3 z-10 inline-flex items-center text-[color:var(--muted)]">
                <Search size={14} />
              </span>
              <input
                type="text"
                value={searchInput}
                onChange={(event) => onSearchInputChange(event.target.value)}
                className={cn(quietSearchInputClass, 'w-full pl-8')}
                placeholder="Search extensions"
                aria-label="Search extensions"
              />
            </label>

            <Tooltip
              content={
                hasSelectedCatalogSources
                  ? `Install ${selectedCatalogSources.length} selected extensions`
                  : 'Install selected extensions'
              }
            >
              <TextButton
                type="button"
                className={cn(compactRoundIconButtonClass, iconActionButtonDisabledClass)}
                onClick={() => void onInstallSelected()}
                disabled={installDisabled}
                aria-label={
                  hasSelectedCatalogSources
                    ? `Install ${selectedCatalogSources.length} selected extensions`
                    : 'Install selected extensions'
                }
              >
                {hasPendingInstall && hasSelectedCatalogSources ? (
                  <Sparkles size={14} />
                ) : (
                  <PackagePlus size={14} />
                )}
              </TextButton>
            </Tooltip>
          </div>

          <SearchExtensionsResults
            catalogError={catalogError}
            catalogItems={catalogItems}
            catalogLoading={catalogLoading}
            installedIdentityKeys={installedIdentityKeys}
            isInstallPending={isInstallPending}
            onToggleSelectedSource={onToggleSelectedSource}
            selectedCatalogSources={selectedCatalogSources}
          />

          <SearchExtensionsLoadMore
            hasNextCatalogPage={hasNextCatalogPage}
            isFetchingNextCatalogPage={isFetchingNextCatalogPage}
            onLoadMore={onLoadMore}
          />
        </>
      ) : null}
    </DisclosureSection>
  )
}
