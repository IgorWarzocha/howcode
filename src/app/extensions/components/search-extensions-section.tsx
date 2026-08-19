import { PackagePlus, Search, Sparkles } from 'lucide-react'
import { DisclosureSection } from '../../common/disclosure-section'
import { TextButton } from '../../common/text-button'
import { Tooltip } from '../../common/tooltip'
import type { PiPackageCatalogItem } from '../../desktop/types'
import {
  appToneMutedClass,
  appTypeGroupTextClass,
  iconActionButtonDisabledClass,
  inlineEmptyNoteClass,
  quietSearchInputClass,
  viewCloseButtonClass,
} from '../../ui/classes'
import {
  skillsActionColumnClass,
  skillsListClass,
  skillsPreviewListClass,
  skillsSearchControlRowClass,
} from '../../ui/screen-classes'
import { cn } from '../../utils/cn'
import { useExtensionCatalog } from '../hooks/useExtensionCatalog'
import type { InstallScope } from '../types'
import { CatalogItemRow } from './catalog-item-row'

type SearchExtensionsSectionProps = {
  installScope: InstallScope
  projectScopeAvailable: boolean
  hasPendingInstall: boolean
  installedIdentityKeys: Set<string>
  onInstall: (source: string, kind: 'npm') => Promise<boolean>
  isInstallPending: (source: string) => boolean
}

function SearchExtensionsResults({
  error,
  expanded,
  installedIdentityKeys,
  isInstallPending,
  items,
  loading,
  onToggleSelectedSource,
  selectedSources,
  submittedSearchInput,
}: {
  error: string | null
  expanded: boolean
  installedIdentityKeys: Set<string>
  isInstallPending: (source: string) => boolean
  items: PiPackageCatalogItem[]
  loading: boolean
  onToggleSelectedSource: (source: string) => void
  selectedSources: string[]
  submittedSearchInput: string
}) {
  if (submittedSearchInput.length < 2) {
    return <div className={inlineEmptyNoteClass}>Search with at least 2 characters.</div>
  }
  if (loading) return <div className={inlineEmptyNoteClass}>Loading packages…</div>
  if (error) {
    return <div className={cn(inlineEmptyNoteClass, 'text-[color:var(--danger)]')}>{error}</div>
  }
  if (items.length === 0) return <div className={inlineEmptyNoteClass}>No pi packages.</div>

  const selectedSourceSet = new Set(selectedSources)
  return (
    <div className={expanded ? skillsListClass : skillsPreviewListClass}>
      {items.map((item) => (
        <CatalogItemRow
          key={item.name}
          item={item}
          selected={selectedSourceSet.has(item.source)}
          installed={installedIdentityKeys.has(item.identityKey)}
          pendingInstall={isInstallPending(item.source)}
          onToggleSelected={onToggleSelectedSource}
        />
      ))}
    </div>
  )
}

function SearchExtensionsLoadMore({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
}) {
  if (!hasNextPage) return null
  return (
    <div className="flex justify-center pt-1">
      <TextButton
        className={`rounded-md px-2 py-1 ${appTypeGroupTextClass} ${appToneMutedClass} hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]`}
        onClick={onLoadMore}
        disabled={isFetchingNextPage}
      >
        {isFetchingNextPage ? 'Loading more…' : 'Load more'}
      </TextButton>
    </div>
  )
}

export function SearchExtensionsSection({
  installScope,
  projectScopeAvailable,
  hasPendingInstall,
  installedIdentityKeys,
  onInstall,
  isInstallPending,
}: SearchExtensionsSectionProps) {
  const catalog = useExtensionCatalog({ installedIdentityKeys, onInstall })
  const hasSelectedSources = catalog.selectedSources.length > 0
  const installDisabled =
    (!projectScopeAvailable && installScope === 'project') ||
    !hasSelectedSources ||
    hasPendingInstall
  const installLabel = hasSelectedSources
    ? `Install ${catalog.selectedSources.length} selected extensions`
    : 'Install extensions'

  return (
    <DisclosureSection
      title="Search"
      open={catalog.open}
      onToggle={() => catalog.setOpen((current) => !current)}
      forceMountContent
      chevronPosition="right"
    >
      <div className={skillsSearchControlRowClass}>
        <form
          className="min-w-0"
          onSubmit={(event) => {
            event.preventDefault()
            catalog.setSubmittedSearchInput(catalog.searchInput.trim())
          }}
        >
          <label className="relative block min-w-0">
            <span className="pointer-events-none absolute inset-y-0 left-3 z-10 inline-flex items-center text-[color:var(--muted)]">
              <Search size={14} />
            </span>
            <input
              type="text"
              value={catalog.searchInput}
              onChange={(event) => catalog.setSearchInput(event.target.value)}
              className={cn(quietSearchInputClass, 'w-full pl-8')}
              placeholder="Search extensions"
              aria-label="Search extensions"
            />
          </label>
        </form>

        <div className={skillsActionColumnClass}>
          <Tooltip content={installLabel}>
            <button
              type="button"
              className={cn(viewCloseButtonClass, iconActionButtonDisabledClass)}
              onClick={() => void catalog.installSelected()}
              disabled={installDisabled}
              aria-label={installLabel}
            >
              {hasPendingInstall && hasSelectedSources ? (
                <Sparkles size={14} />
              ) : (
                <PackagePlus size={14} />
              )}
            </button>
          </Tooltip>
        </div>
      </div>

      <SearchExtensionsResults
        error={catalog.error}
        expanded={catalog.open}
        installedIdentityKeys={installedIdentityKeys}
        isInstallPending={isInstallPending}
        items={catalog.items}
        loading={catalog.isLoading}
        onToggleSelectedSource={catalog.toggleSelectedSource}
        selectedSources={catalog.selectedSources}
        submittedSearchInput={catalog.submittedSearchInput}
      />

      {catalog.open ? (
        <SearchExtensionsLoadMore
          hasNextPage={catalog.hasNextPage}
          isFetchingNextPage={catalog.isFetchingNextPage}
          onLoadMore={catalog.loadMore}
        />
      ) : null}
    </DisclosureSection>
  )
}
