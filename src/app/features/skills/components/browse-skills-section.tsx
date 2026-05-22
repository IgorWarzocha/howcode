import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, Check, CornerDownLeft, PackagePlus, Search, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CompactMetaRow } from '../../../components/common/compact-meta-row'
import { DisclosureSection } from '../../../components/common/disclosure-section'
import { Tooltip } from '../../../components/common/tooltip'
import type { AppSettings, DesktopActionInvoker } from '../../../desktop/types'
import { desktopQueryKeys, searchPiSkillsQuery } from '../../../query/desktop-query'
import {
  appToneDangerClass,
  appToneMutedClass,
  appToneTextClass,
  appTypeGroupTextClass,
  iconActionButtonDisabledClass,
  inlineEmptyNoteClass,
  quietCheckboxCheckedClass,
  quietCheckboxClass,
  quietSearchInputClass,
  viewCloseButtonClass,
} from '../../../ui/classes'
import {
  skillsActionColumnClass,
  skillsBrowsePreferenceButtonClass,
  skillsHeaderActionRailClass,
  skillsListClass,
  skillsPreviewListClass,
  skillsSearchControlRowClass,
} from '../../../ui/screen-classes'
import { cn } from '../../../utils/cn'
import {
  formatInstalls,
  getActionError,
  getCatalogSkillSource,
  normalizeSkillSlug,
  openExternalUrl,
} from '../utils'

type CatalogItem = Awaited<ReturnType<typeof searchPiSkillsQuery>>['items'][number]

function getInstallSources(selectedCatalogSources: string[], catalogItems: CatalogItem[]) {
  const seenSources = new Set<string>()
  return selectedCatalogSources.flatMap((source) => {
    const item = catalogItems.find((catalogItem) => catalogItem.identityKey === source)
    const normalizedSource = item?.identityKey ?? source.trim().toLowerCase()
    if (!item || seenSources.has(normalizedSource)) return []
    seenSources.add(normalizedSource)
    return [getCatalogSkillSource(item)]
  })
}

function BrowseSkillRow({
  installed,
  isPendingInstall,
  item,
  selected,
  setSelectedCatalogSources,
}: {
  installed: boolean
  isPendingInstall: (source: string) => boolean
  item: CatalogItem
  selected: boolean
  setSelectedCatalogSources: React.Dispatch<React.SetStateAction<string[]>>
}) {
  const pendingInstall = isPendingInstall(getCatalogSkillSource(item))
  const selectionLabel = selected ? `Deselect ${item.name}` : `Select ${item.name} for install`
  return (
    <CompactMetaRow
      key={item.id}
      selected={selected}
      density="dense"
      actions={
        <BrowseSkillRowActions
          installed={installed}
          item={item}
          pendingInstall={pendingInstall}
          selected={selected}
          selectionLabel={selectionLabel}
          setSelectedCatalogSources={setSelectedCatalogSources}
        />
      }
      contentClassName={`grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-baseline gap-1.5 overflow-hidden ${appTypeGroupTextClass}`}
    >
      <Tooltip content={item.url} contentClassName="max-w-[420px]">
        <button
          type="button"
          className="group inline-flex shrink-0 items-center gap-0.5 p-0"
          onClick={() => void openExternalUrl(item.url)}
          aria-label={`Open ${item.name}`}
        >
          <span
            className={cn(
              `${appTypeGroupTextClass} ${appToneTextClass}`,
              'transition-colors duration-150 ease-out group-hover:text-[color:var(--accent)]',
            )}
          >
            {item.name}
          </span>
          <ArrowUpRight
            size={12}
            className="shrink-0 text-[color:var(--muted)] transition-colors duration-150 ease-out group-hover:text-[color:var(--accent)]"
          />
        </button>
      </Tooltip>
      <div className={cn(`${appTypeGroupTextClass} ${appToneMutedClass}`, 'min-w-0 truncate')}>
        {item.description || item.source}
      </div>
      <span
        className={cn(
          `${appTypeGroupTextClass} ${appToneMutedClass}`,
          'shrink-0 whitespace-nowrap tabular-nums',
        )}
      >
        {formatInstalls(item.installs)}
      </span>
      {installed ? (
        <span
          className={cn(
            `${appTypeGroupTextClass} ${appToneMutedClass}`,
            'shrink-0 whitespace-nowrap',
          )}
        >
          Installed
        </span>
      ) : null}
    </CompactMetaRow>
  )
}

function BrowseSkillRowActions({
  installed,
  item,
  pendingInstall,
  selected,
  selectionLabel,
  setSelectedCatalogSources,
}: {
  installed: boolean
  item: CatalogItem
  pendingInstall: boolean
  selected: boolean
  selectionLabel: string
  setSelectedCatalogSources: React.Dispatch<React.SetStateAction<string[]>>
}) {
  if (pendingInstall) {
    return (
      <output
        className="inline-flex h-7 w-7 items-center justify-center text-[color:var(--muted)]"
        aria-label={`Installing ${item.name}`}
      >
        <Sparkles size={14} />
      </output>
    )
  }
  if (installed) {
    return (
      <span
        className="inline-flex h-7 w-7 items-center justify-center text-[color:var(--muted)]"
        role="img"
        aria-label={`${item.name} installed`}
      >
        <Check size={14} strokeWidth={2.4} />
      </span>
    )
  }
  return (
    <Tooltip content={selectionLabel}>
      <button
        type="button"
        className={viewCloseButtonClass}
        onClick={() => {
          setSelectedCatalogSources((current) =>
            current.includes(item.identityKey)
              ? current.filter((source) => source !== item.identityKey)
              : [...current, item.identityKey],
          )
        }}
        aria-pressed={selected}
        aria-label={selectionLabel}
      >
        <span
          className={cn(
            'inline-flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border border-[color:var(--muted-2)] bg-transparent transition-colors',
            selected && 'border-[color:var(--accent-border)] text-[color:var(--text)]',
          )}
        >
          {selected ? <Check size={9} strokeWidth={2.6} /> : null}
        </span>
      </button>
    </Tooltip>
  )
}

function BrowseSectionContent({
  catalogItems,
  expanded,
  installedSkillSlugs,
  isPendingInstall,
  selectedCatalogSources,
  setSelectedCatalogSources,
  skillsQuery,
  submittedSearchInput,
}: {
  catalogItems: CatalogItem[]
  expanded: boolean
  installedSkillSlugs: Set<string>
  isPendingInstall: (source: string) => boolean
  selectedCatalogSources: string[]
  setSelectedCatalogSources: React.Dispatch<React.SetStateAction<string[]>>
  skillsQuery: ReturnType<typeof useQuery<Awaited<ReturnType<typeof searchPiSkillsQuery>>>>
  submittedSearchInput: string
}) {
  if (submittedSearchInput.length < 2) {
    return <div className={inlineEmptyNoteClass}>Search with at least 2 characters.</div>
  }
  if (skillsQuery.isLoading) {
    return <div className={inlineEmptyNoteClass}>Loading skills…</div>
  }
  if (skillsQuery.isError) {
    return (
      <div className={`px-2 py-1.5 ${appTypeGroupTextClass} ${appToneDangerClass}`}>
        {getActionError(skillsQuery.error)}
      </div>
    )
  }
  if (catalogItems.length === 0) return <div className={inlineEmptyNoteClass}>No skills found.</div>
  return (
    <div className={expanded ? skillsListClass : skillsPreviewListClass}>
      {catalogItems.map((item) => (
        <BrowseSkillRow
          key={item.id}
          installed={installedSkillSlugs.has(normalizeSkillSlug(item.skillId))}
          isPendingInstall={isPendingInstall}
          item={item}
          selected={selectedCatalogSources.includes(item.identityKey)}
          setSelectedCatalogSources={setSelectedCatalogSources}
        />
      ))}
    </div>
  )
}

type BrowseSkillsSectionProps = {
  appSettings: AppSettings
  installedSkillSlugs: Set<string>
  onAction: DesktopActionInvoker
  onInstall: (source: string) => Promise<boolean>
  isPendingInstall: (source: string) => boolean
  hasPendingInstall: boolean
}

export function BrowseSkillsSection({
  appSettings,
  installedSkillSlugs,
  onAction,
  onInstall,
  isPendingInstall,
  hasPendingInstall,
}: BrowseSkillsSectionProps) {
  const [browseOpen, setBrowseOpen] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [submittedSearchInput, setSubmittedSearchInput] = useState('')
  const [selectedCatalogSources, setSelectedCatalogSources] = useState<string[]>([])

  const normalizedSearchInput = searchInput.trim()
  const hasSelectedCatalogSources = selectedCatalogSources.length > 0
  const searchLimit = browseOpen ? 24 : 12

  const skillsQuery = useQuery({
    queryKey: desktopQueryKeys.piSkillCatalog(submittedSearchInput, searchLimit),
    queryFn: () =>
      searchPiSkillsQuery({
        query: submittedSearchInput,
        limit: searchLimit,
      }),
    staleTime: 5 * 60_000,
    enabled: submittedSearchInput.length >= 2,
  })

  const catalogItems = skillsQuery.data?.items ?? []

  useEffect(() => {
    setSelectedCatalogSources((current) =>
      current.filter((source) => {
        const item = catalogItems.find((catalogItem) => catalogItem.identityKey === source)
        return item ? !installedSkillSlugs.has(normalizeSkillSlug(item.skillId)) : false
      }),
    )
  }, [catalogItems, installedSkillSlugs])

  const handleInstallSelected = async () => {
    const installSources = getInstallSources(selectedCatalogSources, catalogItems)
    if (installSources.length === 0) return
    const installResults = await Promise.all(installSources.map((source) => onInstall(source)))
    if (installResults.some(Boolean)) setSelectedCatalogSources([])
  }

  const browseSectionContent = (
    <BrowseSectionContent
      catalogItems={catalogItems}
      expanded={browseOpen}
      installedSkillSlugs={installedSkillSlugs}
      isPendingInstall={isPendingInstall}
      selectedCatalogSources={selectedCatalogSources}
      setSelectedCatalogSources={setSelectedCatalogSources}
      skillsQuery={skillsQuery}
      submittedSearchInput={submittedSearchInput}
    />
  )

  return (
    <DisclosureSection
      title="Search"
      open={browseOpen}
      onToggle={() => setBrowseOpen((current) => !current)}
      forceMountContent
      chevronPosition="right"
      actionsClassName={skillsHeaderActionRailClass}
      actions={
        <button
          type="button"
          className={skillsBrowsePreferenceButtonClass}
          onClick={() => {
            void onAction('settings.update', {
              key: 'useAgentsSkillsPaths',
              value: !appSettings.useAgentsSkillsPaths,
            })
          }}
          aria-pressed={appSettings.useAgentsSkillsPaths}
        >
          <span>Use .agents instead of .pi?</span>
          <span
            className={cn(
              quietCheckboxClass,
              'justify-self-center',
              appSettings.useAgentsSkillsPaths && quietCheckboxCheckedClass,
            )}
          >
            {appSettings.useAgentsSkillsPaths ? <Check size={11} strokeWidth={2.6} /> : null}
          </span>
        </button>
      }
    >
      <div className={skillsSearchControlRowClass}>
        <form
          className="min-w-0"
          onSubmit={(event) => {
            event.preventDefault()
            setSubmittedSearchInput(normalizedSearchInput)
          }}
        >
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-3 z-10 inline-flex items-center text-[color:var(--muted)]">
              <Search size={14} />
            </div>
            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className={cn(quietSearchInputClass, 'w-full pl-8 pr-9')}
              placeholder="Search skills"
              aria-label="Search skills"
            />
            <Tooltip content="Press Enter to search">
              <button
                type="submit"
                className={cn(
                  'absolute inset-y-0 right-2 flex items-center justify-center text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)] disabled:cursor-not-allowed disabled:opacity-40',
                  'z-10',
                )}
                disabled={normalizedSearchInput.length < 2}
                aria-label="Search skills"
              >
                <span className="flex h-3.5 w-3.5 items-center justify-center">
                  <CornerDownLeft size={12} strokeWidth={2} className="block" />
                </span>
              </button>
            </Tooltip>
          </div>
        </form>

        <div className={skillsActionColumnClass}>
          <Tooltip
            content={
              hasSelectedCatalogSources
                ? `Install ${selectedCatalogSources.length} selected skills`
                : 'Install skills'
            }
          >
            <button
              type="button"
              className={cn(viewCloseButtonClass, iconActionButtonDisabledClass)}
              disabled={!hasSelectedCatalogSources}
              onClick={() => {
                void handleInstallSelected()
              }}
              aria-label={
                hasSelectedCatalogSources
                  ? `Install ${selectedCatalogSources.length} selected skills`
                  : 'Install skills'
              }
            >
              {hasPendingInstall ? <Sparkles size={14} /> : <PackagePlus size={14} />}
            </button>
          </Tooltip>
        </div>
      </div>
      {browseSectionContent}
    </DisclosureSection>
  )
}
