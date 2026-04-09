import { PackagePlus, Search, Sparkles } from "lucide-react";
import { DisclosureSection } from "../../../components/common/DisclosureSection";
import { EmptyStateCard } from "../../../components/common/EmptyStateCard";
import { TextButton } from "../../../components/common/TextButton";
import { Tooltip } from "../../../components/common/Tooltip";
import type { PiPackageCatalogItem } from "../../../desktop/types";
import {
  compactRoundIconButtonClass,
  iconActionButtonDisabledClass,
  settingsInputClass,
} from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import type { InstallScope } from "../types";
import { CatalogItemRow } from "./CatalogItemRow";

type SearchExtensionsSectionProps = {
  open: boolean;
  searchInput: string;
  installScope: InstallScope;
  projectScopeAvailable: boolean;
  hasSelectedCatalogSources: boolean;
  hasPendingInstall: boolean;
  selectedCatalogSources: string[];
  catalogItems: PiPackageCatalogItem[];
  installedIdentityKeys: Set<string>;
  catalogLoading: boolean;
  catalogError: string | null;
  hasNextCatalogPage: boolean;
  isFetchingNextCatalogPage: boolean;
  onToggleOpen: () => void;
  onSearchInputChange: (value: string) => void;
  onInstallSelected: () => void | Promise<void>;
  onToggleSelectedSource: (source: string) => void;
  onLoadMore: () => void;
  isInstallPending: (source: string) => boolean;
};

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
    (!projectScopeAvailable && installScope === "project") ||
    !hasSelectedCatalogSources ||
    hasPendingInstall;

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
                className={cn(settingsInputClass, "w-full pl-8")}
                placeholder="Search extensions"
                aria-label="Search extensions"
              />
            </label>

            <Tooltip
              content={
                hasSelectedCatalogSources
                  ? `Install ${selectedCatalogSources.length} selected extensions`
                  : "Install selected extensions"
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
                    : "Install selected extensions"
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

          {catalogLoading ? (
            <div className="rounded-xl border border-[color:var(--border)] px-3 py-4 text-[12px] text-[color:var(--muted)]">
              Loading packages…
            </div>
          ) : catalogError ? (
            <div className="rounded-xl border border-[color:var(--border)] px-3 py-4 text-[12px] text-[#f2a7a7]">
              {catalogError}
            </div>
          ) : catalogItems.length > 0 ? (
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
          ) : (
            <EmptyStateCard>No pi packages.</EmptyStateCard>
          )}

          {hasNextCatalogPage ? (
            <div className="flex justify-center pt-1">
              <TextButton
                className="rounded-full border border-[color:var(--border)] px-4 py-2 text-[12.5px] text-[color:var(--muted)] hover:text-[color:var(--text)]"
                onClick={onLoadMore}
                disabled={isFetchingNextCatalogPage}
              >
                {isFetchingNextCatalogPage ? "Loading more…" : "Load more"}
              </TextButton>
            </div>
          ) : null}
        </>
      ) : null}
    </DisclosureSection>
  );
}
