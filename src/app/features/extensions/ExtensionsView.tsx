import { ActiveExtensionsSection } from "./components/ActiveExtensionsSection";
import { InstallExtensionsSection } from "./components/InstallExtensionsSection";
import { SearchExtensionsSection } from "./components/SearchExtensionsSection";
import { SegmentedToggle } from "./components/SegmentedToggle";
import { useExtensionsController } from "./hooks/useExtensionsController";
import type { ExtensionsViewProps } from "./types";

const scopeOptions = [
  { value: "global", label: "global" },
  { value: "project", label: "project" },
] as const;

export function ExtensionsView(props: ExtensionsViewProps) {
  const controller = useExtensionsController(props);

  if (!controller.desktopPackagesAvailable) {
    return (
      <div className="mx-auto grid h-full w-full max-w-[860px] content-start gap-4 px-2 pt-6 pb-6">
        <h1 className="m-0 text-[18px] font-medium text-[color:var(--text)]">Extensions</h1>
        <div className="rounded-xl border border-dashed border-[color:var(--border)] px-3 py-4 text-[12px] text-[color:var(--muted)]">
          Desktop build required.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid h-full w-full max-w-[860px] content-start gap-4 px-2 pt-6 pb-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="m-0 text-[18px] font-medium text-[color:var(--text)]">Extensions</h1>
        <SegmentedToggle
          value={controller.installScope}
          options={scopeOptions.map((option) => ({
            ...option,
            disabled: option.value === "project" && !controller.projectScopeAvailable,
          }))}
          onChange={controller.setInstallScope}
        />
      </div>

      {controller.actionError ? (
        <div className="text-[12px] text-[#f2a7a7]">{controller.actionError}</div>
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
    </div>
  );
}
