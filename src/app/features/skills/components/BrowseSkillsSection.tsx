import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  CornerDownLeft,
  PackagePlus,
  Search,
  Sparkles,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { TextButton } from "../../../components/common/TextButton";
import { Tooltip } from "../../../components/common/Tooltip";
import type { AppSettings, DesktopActionInvoker } from "../../../desktop/types";
import { desktopQueryKeys, searchPiSkillsQuery } from "../../../query/desktop-query";
import {
  compactRoundIconButtonClass,
  settingsCompactListRowClass,
  settingsInputClass,
} from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import {
  formatInstalls,
  getActionError,
  getCatalogSkillSource,
  normalizeSkillSlug,
  openExternalUrl,
} from "../utils";

type BrowseSkillsSectionProps = {
  appSettings: AppSettings;
  installedSkillSlugs: Set<string>;
  onAction: DesktopActionInvoker;
  onInstall: (source: string) => Promise<boolean>;
  isPendingInstall: (source: string) => boolean;
  hasPendingInstall: boolean;
};

export function BrowseSkillsSection({
  appSettings,
  installedSkillSlugs,
  onAction,
  onInstall,
  isPendingInstall,
  hasPendingInstall,
}: BrowseSkillsSectionProps) {
  const [browseOpen, setBrowseOpen] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [submittedSearchInput, setSubmittedSearchInput] = useState("");
  const [selectedCatalogSources, setSelectedCatalogSources] = useState<string[]>([]);

  const normalizedSearchInput = searchInput.trim();
  const hasSelectedCatalogSources = selectedCatalogSources.length > 0;

  const skillsQuery = useQuery({
    queryKey: desktopQueryKeys.piSkillCatalog(submittedSearchInput),
    queryFn: () =>
      searchPiSkillsQuery({
        query: submittedSearchInput,
        limit: 12,
      }),
    staleTime: 5 * 60_000,
    enabled: browseOpen && submittedSearchInput.length >= 2,
  });

  const catalogItems = skillsQuery.data?.items ?? [];

  useEffect(() => {
    setSelectedCatalogSources((current) =>
      current.filter((source) => {
        const item = catalogItems.find((catalogItem) => catalogItem.identityKey === source);
        return item ? !installedSkillSlugs.has(normalizeSkillSlug(item.skillId)) : false;
      }),
    );
  }, [catalogItems, installedSkillSlugs]);

  const handleInstallSelected = async () => {
    const installSources: string[] = [];
    const seenSources = new Set<string>();

    for (const source of selectedCatalogSources) {
      const item = catalogItems.find((catalogItem) => catalogItem.identityKey === source);
      const normalizedSource = item?.identityKey ?? source.trim().toLowerCase();

      if (!item || seenSources.has(normalizedSource)) {
        continue;
      }

      installSources.push(getCatalogSkillSource(item));
      seenSources.add(normalizedSource);
    }

    if (installSources.length === 0) {
      return;
    }

    const successfulSources = new Set<string>();

    for (const source of installSources) {
      const installed = await onInstall(source);
      if (installed) {
        successfulSources.add(source.trim().toLowerCase());
      }
    }

    if (successfulSources.size > 0) {
      setSelectedCatalogSources([]);
    }
  };

  const browseSectionContent =
    submittedSearchInput.length < 2 ? null : skillsQuery.isLoading ? (
      <div className="rounded-xl border border-[color:var(--border)] px-3 py-4 text-[12px] text-[color:var(--muted)]">
        Loading skills…
      </div>
    ) : skillsQuery.isError ? (
      <div className="rounded-xl border border-[color:var(--border)] px-3 py-4 text-[12px] text-[#f2a7a7]">
        {getActionError(skillsQuery.error)}
      </div>
    ) : catalogItems.length > 0 ? (
      <div className="grid gap-2">
        {catalogItems.map((item) => {
          const installed = installedSkillSlugs.has(normalizeSkillSlug(item.skillId));
          const pendingInstall = isPendingInstall(getCatalogSkillSource(item));
          const installLabel = pendingInstall
            ? `Installing ${item.name}`
            : installed
              ? `${item.name} installed`
              : `Install ${item.name}`;
          const selected = selectedCatalogSources.includes(item.identityKey);

          return (
            <div
              key={item.id}
              className={cn(settingsCompactListRowClass, selected && "bg-[rgba(255,255,255,0.04)]")}
            >
              <div className="min-w-0 grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-baseline gap-1.5 overflow-hidden">
                <Tooltip content={item.url} contentClassName="max-w-[420px]">
                  <button
                    type="button"
                    className="group inline-flex shrink-0 items-center gap-0.5 p-0"
                    onClick={() => void openExternalUrl(item.url)}
                    aria-label={`Open ${item.name}`}
                  >
                    <span className="text-[13px] leading-4 text-[color:var(--text)] transition-colors duration-150 ease-out group-hover:text-[color:var(--accent)]">
                      {item.name}
                    </span>
                    <ArrowUpRight
                      size={12}
                      className="shrink-0 text-[color:var(--muted)] transition-colors duration-150 ease-out group-hover:text-[color:var(--accent)]"
                    />
                  </button>
                </Tooltip>
                <div className="min-w-0 truncate text-[12px] leading-4 text-[color:var(--muted)]">
                  {item.description || item.source}
                </div>
                <span className="shrink-0 whitespace-nowrap text-[11px] leading-4 text-[color:var(--muted)]">
                  {formatInstalls(item.installs)}
                </span>
                {installed ? (
                  <span className="shrink-0 whitespace-nowrap text-[11px] leading-4 text-[color:var(--muted)]">
                    Installed
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-0.5">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--muted)]">
                  {pendingInstall ? (
                    <Sparkles size={14} />
                  ) : installed ? (
                    <Check size={14} strokeWidth={2.4} />
                  ) : (
                    <Tooltip content={installLabel}>
                      <button
                        type="button"
                        className={compactRoundIconButtonClass}
                        onClick={() => {
                          setSelectedCatalogSources((current) =>
                            current.includes(item.identityKey)
                              ? current.filter((source) => source !== item.identityKey)
                              : [...current, item.identityKey],
                          );
                        }}
                        aria-pressed={selected}
                        aria-label={installLabel}
                      >
                        <span
                          className={cn(
                            "inline-flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border border-[color:var(--muted-2)] bg-transparent transition-colors",
                            selected && "border-[rgba(183,186,245,0.42)] text-[color:var(--text)]",
                          )}
                        >
                          {selected ? <Check size={11} strokeWidth={2.6} /> : null}
                        </span>
                      </button>
                    </Tooltip>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    ) : (
      <div className="rounded-xl border border-dashed border-[color:var(--border)] px-3 py-4 text-[12px] text-[color:var(--muted)]">
        No skills found.
      </div>
    );

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-left text-[13px] font-medium text-[color:var(--text)]"
          onClick={() => setBrowseOpen((current) => !current)}
          aria-expanded={browseOpen}
        >
          {browseOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span>Browse</span>
        </button>

        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-[12px] text-[color:var(--muted)]"
          onClick={() => {
            void onAction("settings.update", {
              key: "useAgentsSkillsPaths",
              value: !appSettings.useAgentsSkillsPaths,
            });
          }}
          aria-pressed={appSettings.useAgentsSkillsPaths}
        >
          <span className="text-[color:var(--muted)]">Use .agents instead of .pi?</span>
          <span
            className={cn(
              "inline-flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border border-[color:var(--border)] bg-transparent text-[color:var(--muted)] transition-colors hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
              appSettings.useAgentsSkillsPaths &&
                "border-[color:var(--border-strong)] bg-[rgba(255,255,255,0.04)] text-[color:var(--muted)]",
            )}
          >
            {appSettings.useAgentsSkillsPaths ? <Check size={11} strokeWidth={2.6} /> : null}
          </span>
        </button>
      </div>

      {browseOpen ? (
        <>
          <div className="flex items-center gap-2">
            <form
              className="min-w-0 flex-1"
              onSubmit={(event) => {
                event.preventDefault();
                setSubmittedSearchInput(normalizedSearchInput);
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
                  className={cn(settingsInputClass, "w-full pl-8 pr-9")}
                  placeholder="Search skills"
                  aria-label="Search skills"
                />
                <Tooltip content="Press Enter to search">
                  <button
                    type="submit"
                    className="absolute inset-y-0 right-2 z-10 flex items-center justify-center text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)] disabled:cursor-not-allowed disabled:opacity-40"
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

            <div className="shrink-0">
              <Tooltip
                content={
                  hasSelectedCatalogSources
                    ? `Install ${selectedCatalogSources.length} selected skills`
                    : "Install skills"
                }
              >
                <TextButton
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full px-0 text-[color:var(--muted)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)] disabled:cursor-not-allowed disabled:bg-transparent disabled:text-[color:var(--muted)] disabled:opacity-40"
                  disabled={!hasSelectedCatalogSources}
                  onClick={() => {
                    void handleInstallSelected();
                  }}
                  aria-label={
                    hasSelectedCatalogSources
                      ? `Install ${selectedCatalogSources.length} selected skills`
                      : "Install skills"
                  }
                >
                  {hasPendingInstall ? <Sparkles size={14} /> : <PackagePlus size={14} />}
                </TextButton>
              </Tooltip>
            </div>
          </div>

          {browseSectionContent}
        </>
      ) : null}
    </div>
  );
}
