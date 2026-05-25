import { ArrowUpRight } from 'lucide-react'
import { ViewHeader } from '../common/view-header'
import { ViewShell } from '../common/view-shell'
import { appToneDangerClass, appToneMutedClass, appTypeGroupTextClass } from '../ui/classes'
import { skillsViewShellClass } from '../ui/screen-classes'
import { cn } from '../utils/cn'
import { ActiveExtensionsSection } from './components/active-extensions-section'
import { InstallExtensionsSection } from './components/install-extensions-section'
import { SearchExtensionsSection } from './components/search-extensions-section'
import { useExtensionsController } from './hooks/useExtensionsController'
import type { ExtensionsViewProps, InstallScope } from './types'
import { openExternalUrl } from './utils'

type ExtensionsScopeSwitcherProps = {
  value: InstallScope
  projectScopeAvailable: boolean
  counts: Record<InstallScope, number>
  onChange: (scope: InstallScope) => void
}

function ExtensionsScopeSwitcher({
  value,
  counts,
  projectScopeAvailable,
  onChange,
}: ExtensionsScopeSwitcherProps) {
  const options: Array<{ value: InstallScope; label: string; disabled?: boolean }> = [
    { value: 'global', label: `Global ${counts.global}` },
    { value: 'project', label: `Project ${counts.project}`, disabled: !projectScopeAvailable },
    { value: 'chat', label: `Chat ${counts.chat}` },
  ]

  return (
    <fieldset className="m-0 flex min-w-0 items-center gap-1 border-0 p-0">
      <legend className="sr-only">Extension install scope</legend>
      {options.map((option) => {
        const selected = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            className={cn(
              `rounded-md px-2 py-0.5 ${appTypeGroupTextClass} ${appToneMutedClass} transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[color:var(--muted)]`,
              selected && 'bg-[color:var(--surface-hover)] text-[color:var(--text)]',
            )}
            disabled={option.disabled}
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </fieldset>
  )
}

function ExtensionsMetaLink() {
  return (
    <span
      className={cn(
        `${appTypeGroupTextClass} ${appToneMutedClass}`,
        'inline-flex items-center gap-1',
      )}
    >
      <span>via</span>
      <button
        type="button"
        className="group inline-flex items-center gap-0.5 p-0 text-inherit"
        onClick={() => void openExternalUrl('https://pi.dev/packages')}
        aria-label="Open pi.dev packages"
        data-tooltip="Open pi.dev packages"
      >
        <span className="transition-colors duration-150 ease-out group-hover:text-[color:var(--accent)]">
          pi.dev
        </span>
        <ArrowUpRight
          size={12}
          className="transition-colors duration-150 ease-out group-hover:text-[color:var(--accent)]"
        />
      </button>
    </span>
  )
}

function DesktopRequiredState({ onClose }: { onClose: () => void }) {
  return (
    <ViewShell className={`${skillsViewShellClass} gap-8`}>
      <ViewHeader
        title="Extensions"
        meta={<ExtensionsMetaLink />}
        onClose={onClose}
        closeLabel="Close extensions"
      />
      <div className={`px-2 py-1.5 ${appTypeGroupTextClass} ${appToneMutedClass}`}>
        Desktop build required.
      </div>
    </ViewShell>
  )
}

export function ExtensionsView(props: ExtensionsViewProps) {
  const controller = useExtensionsController(props)

  if (!controller.desktopPackagesAvailable) {
    return <DesktopRequiredState onClose={props.onClose} />
  }

  return (
    <ViewShell className={skillsViewShellClass}>
      <ViewHeader
        title="Extensions"
        meta={<ExtensionsMetaLink />}
        onClose={props.onClose}
        closeLabel="Close extensions"
        actions={
          <ExtensionsScopeSwitcher
            value={controller.installScope}
            counts={{
              global: controller.globalInstalledCount,
              project: controller.projectInstalledCount,
              chat: controller.chatInstalledCount,
            }}
            projectScopeAvailable={controller.projectScopeAvailable}
            onChange={controller.setInstallScope}
          />
        }
      />

      {controller.projectScopeAvailable ? null : (
        <div className={`px-2 py-1.5 ${appTypeGroupTextClass} ${appToneMutedClass}`}>
          Project extensions are unavailable until a project path is available.
        </div>
      )}

      <output className="sr-only" aria-live="polite">
        {controller.actionError ?? ''}
      </output>
      {controller.actionError ? (
        <div
          className={cn(
            `px-2 py-1.5 ${appTypeGroupTextClass} ${appToneMutedClass}`,
            appToneDangerClass,
          )}
        >
          {controller.actionError}
        </div>
      ) : null}

      <InstallExtensionsSection
        manualSource={controller.manualSource}
        manualSourceKind={controller.manualSourceKind}
        installScope={controller.installScope}
        projectScopeAvailable={controller.projectScopeAvailable}
        hasManualSource={controller.hasManualSource}
        hasPendingInstall={controller.hasPendingInstall}
        manualInstallPending={controller.manualInstallPending}
        onManualSourceChange={controller.setManualSource}
        onManualSourceKindChange={controller.setManualSourceKind}
        onSubmit={controller.handleManualInstall}
      />

      <ActiveExtensionsSection
        open={controller.installedOpen}
        entries={controller.scopedInstalledEntries}
        onToggleOpen={() => controller.setInstalledOpen((current) => !current)}
        onRemove={controller.handleRemove}
        isRemovePending={controller.isRemovePending}
      />

      <SearchExtensionsSection
        open={controller.browseOpen}
        searchInput={controller.searchInput}
        submittedSearchInput={controller.submittedSearchInput}
        installScope={controller.installScope}
        projectScopeAvailable={controller.projectScopeAvailable}
        hasSelectedCatalogSources={controller.hasSelectedCatalogSources}
        hasPendingInstall={controller.hasPendingInstall}
        selectedCatalogSources={controller.selectedCatalogSources}
        catalogItems={controller.catalogItems}
        installedIdentityKeys={controller.installedIdentityKeys}
        catalogLoading={controller.catalogLoading}
        catalogError={controller.catalogError}
        hasNextCatalogPage={controller.hasNextCatalogPage}
        isFetchingNextCatalogPage={controller.isFetchingNextCatalogPage}
        onToggleOpen={() => controller.setBrowseOpen((current) => !current)}
        onSearchInputChange={controller.setSearchInput}
        onSubmitSearch={controller.setSubmittedSearchInput}
        onInstallSelected={controller.handleSelectedCatalogInstall}
        onToggleSelectedSource={controller.toggleCatalogSource}
        onLoadMore={controller.loadMoreCatalog}
        isInstallPending={controller.isInstallPending}
      />
    </ViewShell>
  )
}
