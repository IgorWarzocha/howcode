import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  FilePenLine,
  GitBranch,
  PackagePlus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { type FormEvent, useDeferredValue, useEffect, useMemo, useState } from "react";
import { TextButton } from "../components/common/TextButton";
import { Tooltip } from "../components/common/Tooltip";
import type { PiConfiguredPackage } from "../desktop/types";
import {
  desktopQueryKeys,
  getConfiguredPiPackagesQuery,
  installPiPackageQuery,
  removePiPackageQuery,
  searchPiPackagesQuery,
} from "../query/desktop-query";
import { settingsInputClass, settingsListRowClass } from "../ui/classes";
import { cn } from "../utils/cn";

type ExtensionsViewProps = {
  projectPath: string | null;
  onSetProjectScopeActive: (active: boolean) => void;
};

type PendingAction = {
  kind: "install" | "remove";
  source: string;
};

const compactNumberFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function getActionError(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function formatDownloads(downloads: number) {
  return `${compactNumberFormatter.format(downloads)}/mo`;
}

function normalizeExternalUrl(url: string) {
  return url.replace(/^git\+/, "");
}

function isDesktopPackagesAvailable() {
  return typeof window !== "undefined" && Boolean(window.piDesktop?.searchPiPackages);
}

async function openExternalUrl(url: string) {
  const normalizedUrl = normalizeExternalUrl(url);

  if (window.piDesktop?.openExternal) {
    await window.piDesktop.openExternal(normalizedUrl);
    return;
  }

  window.open(normalizedUrl, "_blank", "noopener,noreferrer");
}

function getInstalledIdentityKeys(packages: PiConfiguredPackage[]) {
  return new Set(
    packages
      .filter(
        (configuredPackage) =>
          configuredPackage.resourceKind === "package" &&
          typeof configuredPackage.installedPath === "string",
      )
      .map((configuredPackage) => configuredPackage.identityKey),
  );
}

function getConfiguredSourceLabel(configuredPackage: PiConfiguredPackage) {
  if (configuredPackage.type === "local") {
    return configuredPackage.source;
  }

  return configuredPackage.type;
}

function isConfiguredSourcePath(configuredPackage: PiConfiguredPackage) {
  return configuredPackage.type === "local";
}

export function ExtensionsView({ projectPath, onSetProjectScopeActive }: ExtensionsViewProps) {
  const queryClient = useQueryClient();
  const normalizedProjectPath = projectPath?.trim() ? projectPath : null;
  const [searchInput, setSearchInput] = useState("");
  const [manualSource, setManualSource] = useState("");
  const [manualSourceKind, setManualSourceKind] = useState<"npm" | "git">("npm");
  const [installScope, setInstallScope] = useState<"global" | "project">("global");
  const [installedOpen, setInstalledOpen] = useState(true);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [selectedCatalogSources, setSelectedCatalogSources] = useState<string[]>([]);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const deferredSearchInput = useDeferredValue(searchInput.trim());
  const desktopPackagesAvailable = isDesktopPackagesAvailable();

  const configuredPackagesQuery = useQuery({
    queryKey: desktopQueryKeys.configuredPiPackages(projectPath),
    queryFn: () => getConfiguredPiPackagesQuery({ projectPath }),
    staleTime: 30_000,
    enabled: desktopPackagesAvailable,
  });

  const packagesQuery = useInfiniteQuery({
    queryKey: desktopQueryKeys.piPackageCatalog(deferredSearchInput),
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      searchPiPackagesQuery({
        query: deferredSearchInput,
        cursor: typeof pageParam === "number" ? pageParam : 0,
        pageSize: 24,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 5 * 60_000,
    enabled: desktopPackagesAvailable && browseOpen,
  });

  const configuredPackages = configuredPackagesQuery.data ?? [];
  const installedEntries = useMemo(
    () =>
      configuredPackages.filter(
        (configuredPackage) => typeof configuredPackage.installedPath === "string",
      ),
    [configuredPackages],
  );
  const scopedInstalledEntries = useMemo(
    () =>
      installedEntries.filter((configuredPackage) =>
        installScope === "project"
          ? configuredPackage.scope === "project"
          : configuredPackage.scope === "user",
      ),
    [installScope, installedEntries],
  );
  const installedIdentityKeys = useMemo(
    () => getInstalledIdentityKeys(configuredPackages),
    [configuredPackages],
  );
  const catalogItems = useMemo(
    () => packagesQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [packagesQuery.data?.pages],
  );
  const projectScopeAvailable = normalizedProjectPath !== null;

  useEffect(() => {
    if (!projectScopeAvailable && installScope === "project") {
      setInstallScope("global");
    }
  }, [installScope, projectScopeAvailable]);

  useEffect(() => {
    onSetProjectScopeActive(installScope === "project");

    return () => {
      onSetProjectScopeActive(false);
    };
  }, [installScope, onSetProjectScopeActive]);

  useEffect(() => {
    setSelectedCatalogSources((current) =>
      current.filter((source) => {
        const item = catalogItems.find((catalogItem) => catalogItem.source === source);
        return item ? !installedIdentityKeys.has(item.identityKey) : false;
      }),
    );
  }, [catalogItems, installedIdentityKeys]);

  const updateConfiguredPackagesCache = (packages: PiConfiguredPackage[]) => {
    queryClient.setQueryData(desktopQueryKeys.configuredPiPackages(projectPath), packages);
  };

  const addPendingAction = (action: PendingAction) => {
    setPendingActions((current) => [...current, action]);
  };

  const removePendingAction = (action: PendingAction) => {
    setPendingActions((current) =>
      current.filter(
        (currentAction) =>
          currentAction.kind !== action.kind || currentAction.source !== action.source,
      ),
    );
  };

  const isPending = (kind: PendingAction["kind"], source: string) => {
    const normalizedSource = source.trim().toLowerCase();
    return pendingActions.some(
      (action) => action.kind === kind && action.source.trim().toLowerCase() === normalizedSource,
    );
  };

  const hasSelectedCatalogSources = selectedCatalogSources.length > 0;
  const hasManualSource = manualSource.trim().length > 0;
  const hasPendingInstall = pendingActions.some((action) => action.kind === "install");

  const handleInstall = async (source: string, kind: "npm" | "git") => {
    if (installScope === "project" && !normalizedProjectPath) {
      setActionError("Select a project first.");
      return false;
    }

    const normalizedSource = source.trim();
    const pendingAction = { kind: "install" as const, source: normalizedSource };

    addPendingAction(pendingAction);
    setActionError(null);

    try {
      const result = await installPiPackageQuery({
        source: normalizedSource,
        kind,
        local: installScope === "project",
        projectPath: normalizedProjectPath,
      });

      if (result?.configuredPackages) {
        updateConfiguredPackagesCache(result.configuredPackages);
      }

      return true;
    } catch (error) {
      setActionError(getActionError(error));
      return false;
    } finally {
      removePendingAction(pendingAction);
    }
  };

  const handleRemove = async (configuredPackage: PiConfiguredPackage) => {
    const pendingAction = { kind: "remove" as const, source: configuredPackage.source };

    addPendingAction(pendingAction);
    setActionError(null);

    try {
      const result = await removePiPackageQuery({
        source: configuredPackage.source,
        local: configuredPackage.scope === "project",
        projectPath: normalizedProjectPath,
      });

      if (result?.configuredPackages) {
        updateConfiguredPackagesCache(result.configuredPackages);
      }
    } catch (error) {
      setActionError(getActionError(error));
    } finally {
      removePendingAction(pendingAction);
    }
  };

  const handleManualInstall = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const manualSourceValue = manualSource.trim();

    if (!manualSourceValue) {
      return;
    }

    const installed = await handleInstall(manualSourceValue, manualSourceKind);
    if (installed) {
      setManualSource("");
    }
  };

  const handleSelectedCatalogInstall = async () => {
    if (selectedCatalogSources.length === 0) {
      return;
    }

    const successfulSources = new Set<string>();

    for (const source of selectedCatalogSources) {
      const installed = await handleInstall(source, "npm");
      if (installed) {
        successfulSources.add(source.trim().toLowerCase());
      }
    }

    if (successfulSources.size > 0) {
      setSelectedCatalogSources((current) =>
        current.filter((source) => !successfulSources.has(source.trim().toLowerCase())),
      );
    }
  };

  const installedSectionContent =
    scopedInstalledEntries.length > 0 ? (
      <div className="grid gap-2">
        {scopedInstalledEntries.map((configuredPackage) => (
          <div
            key={`${configuredPackage.scope}:${configuredPackage.source}`}
            className={cn(settingsListRowClass, "gap-2 py-2")}
          >
            <div className="flex min-w-0 items-center gap-2">
              <div className="truncate text-[13px] text-[color:var(--text)]">
                {configuredPackage.displayName}
              </div>
              {isConfiguredSourcePath(configuredPackage) ? (
                <div className="truncate text-[12px] text-[color:var(--muted)]">
                  {getConfiguredSourceLabel(configuredPackage)}
                </div>
              ) : (
                <div className="shrink-0 text-[12px] text-[color:var(--muted)]">
                  {getConfiguredSourceLabel(configuredPackage)}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              {(configuredPackage.type === "local" ||
                configuredPackage.resourceKind === "extension") &&
              configuredPackage.settingsPath ? (
                <Tooltip content="Open settings.json in default editor">
                  <TextButton
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full px-0 text-[color:var(--muted)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]"
                    onClick={() => {
                      if (configuredPackage.settingsPath) {
                        void window.piDesktop?.openPath?.(configuredPackage.settingsPath);
                      }
                    }}
                    aria-label="Open settings.json in default editor"
                  >
                    <FilePenLine size={13} />
                  </TextButton>
                </Tooltip>
              ) : null}
              {configuredPackage.resourceKind === "package" ? (
                <Tooltip
                  content={isPending("remove", configuredPackage.source) ? "Removing" : "Remove"}
                >
                  <TextButton
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full px-0 text-[color:var(--muted)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#ffb4b4]"
                    onClick={() => void handleRemove(configuredPackage)}
                    disabled={isPending("remove", configuredPackage.source)}
                    aria-label={
                      isPending("remove", configuredPackage.source) ? "Removing" : "Remove"
                    }
                  >
                    <Trash2 size={13} />
                  </TextButton>
                </Tooltip>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="rounded-xl border border-dashed border-[color:var(--border)] px-3 py-4 text-[12px] text-[color:var(--muted)]">
        No installed extensions.
      </div>
    );

  const browseSectionContent = packagesQuery.isLoading ? (
    <div className="rounded-xl border border-[color:var(--border)] px-3 py-4 text-[12px] text-[color:var(--muted)]">
      Loading packages…
    </div>
  ) : packagesQuery.isError ? (
    <div className="rounded-xl border border-[color:var(--border)] px-3 py-4 text-[12px] text-[#f2a7a7]">
      {getActionError(packagesQuery.error)}
    </div>
  ) : catalogItems.length > 0 ? (
    <div className="grid gap-2">
      {catalogItems.map((item) => {
        const installed = installedIdentityKeys.has(item.identityKey);
        const pendingInstall = isPending("install", item.source);
        const externalUrl = item.repositoryUrl ?? item.homepageUrl ?? item.npmUrl;
        const installLabel = pendingInstall
          ? `Installing ${item.name}`
          : installed
            ? `${item.name} installed`
            : `Install ${item.name}`;

        return (
          <div
            key={item.name}
            className={cn(
              settingsListRowClass,
              "gap-2 py-2",
              selectedCatalogSources.includes(item.source) && "bg-[rgba(255,255,255,0.04)]",
            )}
          >
            <div className="min-w-0 grid gap-0.5">
              <div className="flex items-center gap-2">
                <Tooltip content={externalUrl} contentClassName="max-w-[420px]">
                  <button
                    type="button"
                    className="group inline-flex min-w-0 items-center gap-0.5 p-0"
                    onClick={() => void openExternalUrl(externalUrl)}
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
                  {formatDownloads(item.monthlyDownloads)}
                </span>
                <span className="text-[11px] text-[color:var(--muted)]">v{item.version}</span>
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
                        setSelectedCatalogSources((current) => {
                          if (current.includes(item.source)) {
                            return current.filter((source) => source !== item.source);
                          }

                          return [...current, item.source];
                        });
                      }}
                      aria-pressed={selectedCatalogSources.includes(item.source)}
                      aria-label={installLabel}
                    >
                      <span
                        className={cn(
                          "inline-flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border border-[color:var(--muted-2)] bg-transparent transition-colors",
                          selectedCatalogSources.includes(item.source) &&
                            "border-[rgba(183,186,245,0.42)] text-[color:var(--text)]",
                        )}
                      >
                        {selectedCatalogSources.includes(item.source) ? (
                          <Check size={11} strokeWidth={2.6} />
                        ) : null}
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
      No pi packages.
    </div>
  );

  if (!desktopPackagesAvailable) {
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
        <div className="inline-flex rounded-full border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] p-1">
          {(["global", "project"] as const).map((scope) => (
            <button
              key={scope}
              type="button"
              className={cn(
                "rounded-full px-3 py-1 text-[12px] capitalize transition-colors",
                installScope === scope
                  ? "bg-[rgba(255,255,255,0.18)] font-medium text-[color:var(--text)] shadow-[inset_0_0_0_1px_rgba(183,186,245,0.5)]"
                  : "text-[color:var(--muted)] hover:text-[color:var(--text)]",
              )}
              onClick={() => setInstallScope(scope)}
              aria-pressed={installScope === scope}
              disabled={scope === "project" && !projectScopeAvailable}
            >
              {scope}
            </button>
          ))}
        </div>
      </div>

      {actionError ? <div className="text-[12px] text-[#f2a7a7]">{actionError}</div> : null}

      <div className="grid gap-2">
        <div className="inline-flex items-center gap-1.5 text-left text-[13px] font-medium text-[color:var(--text)]">
          <span>Install</span>
        </div>

        <form
          className="grid gap-2 md:grid-cols-[auto_minmax(0,1fr)_auto]"
          onSubmit={handleManualInstall}
        >
          <div className="inline-flex rounded-full border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] p-1">
            {(["npm", "git"] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                className={cn(
                  "rounded-full px-3 py-1 text-[12px] capitalize transition-colors",
                  manualSourceKind === kind
                    ? "bg-[rgba(255,255,255,0.18)] font-medium text-[color:var(--text)] shadow-[inset_0_0_0_1px_rgba(183,186,245,0.5)]"
                    : "text-[color:var(--muted)] hover:text-[color:var(--text)]",
                )}
                onClick={() => setManualSourceKind(kind)}
                aria-pressed={manualSourceKind === kind}
              >
                {kind}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={manualSource}
            onChange={(event) => setManualSource(event.target.value)}
            className={settingsInputClass}
            placeholder={
              manualSourceKind === "npm"
                ? "Package name or npm:@scope/pkg"
                : "git:github.com/user/repo or https://…"
            }
            aria-label={manualSourceKind === "npm" ? "Install npm package" : "Install git package"}
          />

          <Tooltip content={hasManualSource ? `Install ${manualSourceKind} source` : "Install"}>
            <TextButton
              type="submit"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full px-0 text-[color:var(--muted)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)] disabled:cursor-not-allowed disabled:bg-transparent disabled:text-[color:var(--muted)] disabled:opacity-40"
              disabled={
                !projectScopeAvailable && installScope === "project"
                  ? true
                  : !hasManualSource || isPending("install", manualSource) || hasPendingInstall
              }
              aria-label={hasManualSource ? `Install ${manualSourceKind} source` : "Install"}
            >
              {hasPendingInstall && hasManualSource ? (
                <Sparkles size={14} />
              ) : (
                <PackagePlus size={14} />
              )}
            </TextButton>
          </Tooltip>
        </form>
      </div>

      <div className="grid gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-left text-[13px] font-medium text-[color:var(--text)]"
          onClick={() => setInstalledOpen((current) => !current)}
          aria-expanded={installedOpen}
        >
          {installedOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span>Active</span>
        </button>

        {installedOpen ? installedSectionContent : null}
      </div>

      <div className="grid gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-left text-[13px] font-medium text-[color:var(--text)]"
          onClick={() => setBrowseOpen((current) => !current)}
          aria-expanded={browseOpen}
        >
          {browseOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span>Search</span>
        </button>

        {browseOpen ? (
          <>
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
              <label className="flex items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-[color:var(--muted)] focus-within:text-[color:var(--text)]">
                <Search size={14} />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-[13px] text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted)]"
                  placeholder="Search pi packages"
                  aria-label="Search pi packages"
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
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full px-0 text-[color:var(--muted)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)] disabled:cursor-not-allowed disabled:bg-transparent disabled:text-[color:var(--muted)] disabled:opacity-40"
                  onClick={() => void handleSelectedCatalogInstall()}
                  disabled={
                    !projectScopeAvailable && installScope === "project"
                      ? true
                      : !hasSelectedCatalogSources || hasPendingInstall
                  }
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

            {browseSectionContent}

            {packagesQuery.hasNextPage ? (
              <div className="flex justify-center pt-1">
                <TextButton
                  className="rounded-full border border-[color:var(--border)] px-4 py-2 text-[12.5px] text-[color:var(--muted)] hover:text-[color:var(--text)]"
                  onClick={() => void packagesQuery.fetchNextPage()}
                  disabled={packagesQuery.isFetchingNextPage}
                >
                  {packagesQuery.isFetchingNextPage ? "Loading more…" : "Load more"}
                </TextButton>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
