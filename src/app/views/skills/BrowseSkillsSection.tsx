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
import { TextButton } from "../../components/common/TextButton";
import { Tooltip } from "../../components/common/Tooltip";
import type { AppSettings, DesktopActionResult } from "../../desktop/types";
import { desktopQueryKeys, searchPiSkillsQuery } from "../../query/desktop-query";
import { settingsInputClass, settingsListRowClass } from "../../ui/classes";
import { cn } from "../../utils/cn";
import { formatInstalls, getActionError, openExternalUrl } from "./helpers";

type BrowseSkillsSectionProps = {
  appSettings: AppSettings;
  installedIdentityKeys: Set<string>;
  onAction: (
    action: "settings.update",
    payload?: Record<string, unknown>,
  ) => Promise<DesktopActionResult | null>;
  onInstall: (source: string) => Promise<boolean>;
  isPendingInstall: (source: string) => boolean;
  hasPendingInstall: boolean;
};

export function BrowseSkillsSection({
  appSettings,
  installedIdentityKeys,
  onAction,
  onInstall,
  isPendingInstall,
  hasPendingInstall,
}: BrowseSkillsSectionProps) {
  const [browseOpen, setBrowseOpen] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [submittedSearchInput, setSubmittedSearchInput] = useState("");
  const [manualSource, setManualSource] = useState("");
  const [selectedCatalogSources, setSelectedCatalogSources] = useState<string[]>([]);

  const normalizedSearchInput = searchInput.trim();
  const hasManualSource = manualSource.trim().length > 0;
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
        return item ? !installedIdentityKeys.has(item.identityKey) : false;
      }),
    );
  }, [catalogItems, installedIdentityKeys]);

  const handleManualInstall = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const installSources: string[] = [];
    const seenSources = new Set<string>();
    const manualSourceValue = manualSource.trim();

    if (manualSourceValue) {
      installSources.push(manualSourceValue);
      seenSources.add(manualSourceValue.toLowerCase());
    }

    for (const source of selectedCatalogSources) {
      const item = catalogItems.find((catalogItem) => catalogItem.identityKey === source);
      const normalizedSource = item?.identityKey ?? source.trim().toLowerCase();

      if (!item || seenSources.has(normalizedSource)) {
        continue;
      }

      installSources.push(`${item.source}@${item.name}`);
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

    if (manualSourceValue && successfulSources.has(manualSourceValue.toLowerCase())) {
      setManualSource("");
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
          const installed = installedIdentityKeys.has(item.identityKey);
          const pendingInstall = isPendingInstall(`${item.source}@${item.name}`);
          const installLabel = pendingInstall
            ? `Installing ${item.name}`
            : installed
              ? `${item.name} installed`
              : `Install ${item.name}`;
          const selected = selectedCatalogSources.includes(item.identityKey);

          return (
            <div
              key={item.id}
              className={cn(
                settingsListRowClass,
                "gap-2 py-2",
                selected && "bg-[rgba(255,255,255,0.04)]",
              )}
            >
              <div className="min-w-0 grid gap-0.5">
                <div className="flex items-center gap-2">
                  <Tooltip content={item.url} contentClassName="max-w-[420px]">
                    <button
                      type="button"
                      className="group inline-flex min-w-0 items-center gap-0.5 p-0"
                      onClick={() => void openExternalUrl(item.url)}
                      aria-label={`Open ${item.name}`}
                    >
                      <span className="truncate text-[13px] text-[color:var(--text)] transition-colors duration-150 ease-out group-hover:text-[color:var(--accent)]">
                        {item.name}
                      </span>
                      <ArrowUpRight
                        size={12}
                        className="shrink-0 text-[color:var(--muted)] transition-colors duration-150 ease-out group-hover:text-[color:var(--accent)]"
                      />
                    </button>
                  </Tooltip>
                  <span className="text-[11px] text-[color:var(--muted)]">
                    {formatInstalls(item.installs)}
                  </span>
                  {installed ? (
                    <span className="text-[11px] text-[color:var(--muted)]">Installed</span>
                  ) : null}
                </div>
                <div className="truncate text-[12px] text-[color:var(--muted)]">
                  {item.description || item.source}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--muted)]">
                  {pendingInstall ? (
                    <Sparkles size={14} />
                  ) : installed ? (
                    <Check size={14} strokeWidth={2.4} />
                  ) : (
                    <Tooltip content={installLabel}>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]"
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
          <form
            className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]"
            onSubmit={handleManualInstall}
          >
            <input
              type="text"
              value={manualSource}
              onChange={(event) => setManualSource(event.target.value)}
              className={settingsInputClass}
              placeholder="owner/repo@skill or https://skills.sh/owner/repo/skill"
              aria-label="Install skill source"
            />

            <Tooltip
              content={
                hasManualSource
                  ? "Install skill source"
                  : hasSelectedCatalogSources
                    ? `Install ${selectedCatalogSources.length} selected skills`
                    : "Install skills"
              }
            >
              <TextButton
                type="submit"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full px-0 text-[color:var(--muted)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)] disabled:cursor-not-allowed disabled:bg-transparent disabled:text-[color:var(--muted)] disabled:opacity-40"
                disabled={
                  (!hasManualSource && !hasSelectedCatalogSources) ||
                  (hasManualSource && isPendingInstall(manualSource))
                }
                aria-label={
                  hasManualSource
                    ? "Install skill source"
                    : hasSelectedCatalogSources
                      ? `Install ${selectedCatalogSources.length} selected skills`
                      : "Install skills"
                }
              >
                {hasPendingInstall ? <Sparkles size={14} /> : <PackagePlus size={14} />}
              </TextButton>
            </Tooltip>
          </form>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              setSubmittedSearchInput(normalizedSearchInput);
            }}
          >
            <label className="flex items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-[color:var(--muted)] focus-within:text-[color:var(--text)]">
              <Search size={14} />
              <input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[13px] text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted)]"
                placeholder="Search skills"
                aria-label="Search skills"
              />
              <Tooltip content="Press Enter to search">
                <button
                  type="submit"
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[color:var(--muted)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)] disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={normalizedSearchInput.length < 2}
                  aria-label="Search skills"
                >
                  <CornerDownLeft size={14} />
                </button>
              </Tooltip>
            </label>
          </form>

          {browseSectionContent}
        </>
      ) : null}
    </div>
  );
}
