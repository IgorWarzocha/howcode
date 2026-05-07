import { EmptyStateCard } from '../../components/common/empty-state-card'
import { SegmentedToggle } from '../../components/common/segmented-toggle'
import { ViewHeader } from '../../components/common/view-header'
import { ViewShell } from '../../components/common/view-shell'
import { ActiveExtensionsSection } from './components/active-extensions-section'
import { InstallExtensionsSection } from './components/install-extensions-section'
import { SearchExtensionsSection } from './components/search-extensions-section'
import { useExtensionsController } from './hooks/useExtensionsController'
import type { ExtensionsViewProps } from './types'

function ExtensionsScopeToggle({
  globalInstalledCount,
  chatInstalledCount,
  installScope,
  projectInstalledCount,
  projectScopeAvailable,
  onScopeChange,
}: {
  globalInstalledCount: number
  chatInstalledCount: number
  installScope: 'global' | 'project' | 'chat'
  projectInstalledCount: number
  projectScopeAvailable: boolean
  onScopeChange: (scope: 'global' | 'project' | 'chat') => void
}) {
  return (
    <SegmentedToggle
      size="compact"
      ariaLabel="Extension install scope"
      value={installScope}
      options={[
        { value: 'global', label: `Global (${globalInstalledCount})` },
        {
          value: 'project',
          label: `Project (${projectInstalledCount})`,
          disabled: !projectScopeAvailable,
        },
        { value: 'chat', label: `Chat (${chatInstalledCount})` },
      ]}
      onChange={onScopeChange}
    />
  )
}

export function ExtensionsView(props: ExtensionsViewProps) {
  const controller = useExtensionsController(props)

  if (!controller.desktopPackagesAvailable) {
    return (
      <ViewShell>
        <ViewHeader title="Extensions" onClose={props.onClose} closeLabel="Close extensions" />
        <EmptyStateCard>Desktop build required.</EmptyStateCard>
      </ViewShell>
    )
  }

  return (
    <ViewShell>
      <ViewHeader
        title="Extensions"
        onClose={props.onClose}
        closeLabel="Close extensions"
        actions={
          <ExtensionsScopeToggle
            globalInstalledCount={controller.globalInstalledCount}
            chatInstalledCount={controller.chatInstalledCount}
            installScope={controller.installScope}
            projectInstalledCount={controller.projectInstalledCount}
            projectScopeAvailable={controller.projectScopeAvailable}
            onScopeChange={controller.setInstallScope}
          />
        }
      />

      <output className="sr-only" aria-live="polite">
        {controller.actionError ?? ''}
      </output>
      {controller.actionError ? (
        <div className="text-[12px] text-[color:var(--danger)]">{controller.actionError}</div>
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
        onInstallSelected={controller.handleSelectedCatalogInstall}
        onToggleSelectedSource={controller.toggleCatalogSource}
        onLoadMore={controller.loadMoreCatalog}
        isInstallPending={controller.isInstallPending}
      />
    </ViewShell>
  )
}
