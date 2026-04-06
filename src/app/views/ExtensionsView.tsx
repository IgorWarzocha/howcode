import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Download,
  GitBranch,
  PackagePlus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { type FormEvent, useDeferredValue, useMemo, useState } from "react";
import { PrimaryButton } from "../components/common/PrimaryButton";
import { TextButton } from "../components/common/TextButton";
import type { PiConfiguredPackage } from "../desktop/types";
import {
  desktopQueryKeys,
  getConfiguredPiPackagesQuery,
  installPiPackageQuery,
  removePiPackageQuery,
  searchPiPackagesQuery,
} from "../query/desktop-query";
import { settingsInputClass, settingsListRowClass, settingsSectionClass } from "../ui/classes";
import { cn } from "../utils/cn";

type PendingAction = {
  kind: "install" | "remove";
  source: string;
};

const compactNumberFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function getActionError(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function formatDownloads(downloads: number) {
  return `${compactNumberFormatter.format(downloads)}/mo`;
}

function formatPublishedAt(date: string) {
  const parsedDate = new Date(date);
  return Number.isNaN(parsedDate.getTime()) ? null : dateFormatter.format(parsedDate);
}

function normalizeExternalUrl(url: string) {
  return url.replace(/^git\+/, "");
}

function isDesktopPackagesAvailable() {
  return typeof window !== "undefined" && Boolean(window.piDesktop?.searchPiPackages);
}

async function openExternalUrl(url: string) {
  if (!url) {
    return;
  }

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
      .filter((configuredPackage) => typeof configuredPackage.installedPath === "string")
      .map((configuredPackage) => configuredPackage.identityKey),
  );
}

export function ExtensionsView() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [manualSource, setManualSource] = useState("");
  const [manualSourceKind, setManualSourceKind] = useState<"npm" | "git">("npm");
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const deferredSearchInput = useDeferredValue(searchInput.trim());
  const desktopPackagesAvailable = isDesktopPackagesAvailable();

  const configuredPackagesQuery = useQuery({
    queryKey: desktopQueryKeys.configuredPiPackages(),
    queryFn: getConfiguredPiPackagesQuery,
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
    enabled: desktopPackagesAvailable,
  });

  const configuredPackages = configuredPackagesQuery.data ?? [];
  const installedPackages = useMemo(
    () =>
      configuredPackages.filter(
        (configuredPackage) => typeof configuredPackage.installedPath === "string",
      ),
    [configuredPackages],
  );
  const installedIdentityKeys = useMemo(
    () => getInstalledIdentityKeys(configuredPackages),
    [configuredPackages],
  );
  const catalogItems = useMemo(
    () => packagesQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [packagesQuery.data?.pages],
  );
  const totalPackages = packagesQuery.data?.pages[0]?.total ?? 0;

  const updateConfiguredPackagesCache = (packages: PiConfiguredPackage[]) => {
    queryClient.setQueryData(desktopQueryKeys.configuredPiPackages(), packages);
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

  const handleInstall = async (source: string, kind: "npm" | "git") => {
    const normalizedSource = source.trim();
    const pendingAction = { kind: "install" as const, source: normalizedSource };

    addPendingAction(pendingAction);
    setActionError(null);

    try {
      const result = await installPiPackageQuery({ source: normalizedSource, kind });
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
    const source = manualSource.trim();

    if (!source) {
      return;
    }

    const installed = await handleInstall(source, manualSourceKind);
    if (installed) {
      setManualSource("");
    }
  };

  if (!desktopPackagesAvailable) {
    return (
      <div className="mx-auto grid h-full w-full max-w-[760px] content-start gap-4 px-2 pt-6 pb-6">
        <div className="grid gap-1">
          <h1 className="m-0 text-[18px] font-medium text-[color:var(--text)]">Extensions</h1>
          <p className="m-0 text-[13px] text-[color:var(--muted)]">
            Open the desktop build to browse and install extensions here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid h-full w-full max-w-[860px] content-start gap-4 px-2 pt-6 pb-6">
      <div className="grid gap-1">
        <h1 className="m-0 text-[18px] font-medium text-[color:var(--text)]">Extensions</h1>
        <p className="m-0 text-[13px] text-[color:var(--muted)]">
          Popular pi packages from npm, plus direct install from npm or git.
        </p>
      </div>

      <section className={settingsSectionClass}>
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
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
          <div className="text-[12px] text-[color:var(--muted)]">
            {totalPackages > 0
              ? `${compactNumberFormatter.format(totalPackages)} results · most downloaded first`
              : "Searching npm…"}
          </div>
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
                    ? "bg-[rgba(183,186,245,0.16)] text-[color:var(--text)]"
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

          <PrimaryButton
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 px-3 disabled:cursor-not-allowed disabled:opacity-45"
            disabled={manualSource.trim().length === 0 || isPending("install", manualSource)}
          >
            {isPending("install", manualSource) ? (
              <>
                <Sparkles size={14} />
                Installing…
              </>
            ) : (
              <>
                {manualSourceKind === "npm" ? <PackagePlus size={14} /> : <GitBranch size={14} />}
                Install
              </>
            )}
          </PrimaryButton>
        </form>

        {actionError ? <div className="text-[12px] text-[#f2a7a7]">{actionError}</div> : null}
      </section>

      <section className={settingsSectionClass}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="m-0 text-[15px] font-medium text-[color:var(--text)]">Installed</h2>
          <div className="text-[12px] text-[color:var(--muted)]">{installedPackages.length}</div>
        </div>

        {installedPackages.length > 0 ? (
          <div className="grid gap-2">
            {installedPackages.map((configuredPackage) => (
              <div
                key={`${configuredPackage.scope}:${configuredPackage.source}`}
                className={cn(settingsListRowClass, "gap-2 py-2")}
              >
                <div className="min-w-0 grid gap-0.5">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-[13px] text-[color:var(--text)]">
                      {configuredPackage.displayName}
                    </div>
                    <span className="text-[11px] text-[color:var(--muted)]">
                      {configuredPackage.scope}
                    </span>
                  </div>
                  <div className="truncate text-[12px] text-[color:var(--muted)]">
                    {configuredPackage.source}
                  </div>
                </div>

                <TextButton
                  className="inline-flex items-center gap-1.5 px-2 py-1.5 text-[12px] text-[color:var(--muted)] hover:text-[#ffb4b4]"
                  onClick={() => void handleRemove(configuredPackage)}
                  disabled={isPending("remove", configuredPackage.source)}
                >
                  <Trash2 size={13} />
                  {isPending("remove", configuredPackage.source) ? "Removing…" : "Remove"}
                </TextButton>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[color:var(--border)] px-3 py-4 text-[12px] text-[color:var(--muted)]">
            No installed packages yet.
          </div>
        )}
      </section>

      <section className={settingsSectionClass}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="m-0 text-[15px] font-medium text-[color:var(--text)]">Browse</h2>
          <div className="text-[12px] text-[color:var(--muted)]">npm</div>
        </div>

        {packagesQuery.isLoading ? (
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
              const publishedAt = formatPublishedAt(item.publishedAt);

              return (
                <div key={item.name} className={cn(settingsListRowClass, "gap-2 py-2")}>
                  <div className="min-w-0 grid gap-0.5">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-[13px] text-[color:var(--text)]">
                        {item.name}
                      </div>
                      <span className="text-[11px] text-[color:var(--muted)]">
                        {formatDownloads(item.monthlyDownloads)}
                      </span>
                      <span className="text-[11px] text-[color:var(--muted)]">v{item.version}</span>
                      {publishedAt ? (
                        <span className="hidden text-[11px] text-[color:var(--muted)] sm:inline">
                          {publishedAt}
                        </span>
                      ) : null}
                    </div>
                    {item.description ? (
                      <div className="truncate text-[12px] text-[color:var(--muted)]">
                        {item.description}
                      </div>
                    ) : (
                      <div className="truncate text-[12px] text-[color:var(--muted)]">
                        {item.source}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <TextButton
                      className="inline-flex items-center gap-1 px-2 py-1.5 text-[12px] text-[color:var(--muted)]"
                      onClick={() =>
                        void openExternalUrl(item.repositoryUrl ?? item.homepageUrl ?? item.npmUrl)
                      }
                    >
                      Open
                      <ArrowUpRight size={12} />
                    </TextButton>
                    <PrimaryButton
                      className="inline-flex items-center gap-1.5 px-3 disabled:cursor-default disabled:opacity-60"
                      onClick={() => void handleInstall(item.source, "npm")}
                      disabled={installed || pendingInstall}
                    >
                      {pendingInstall ? (
                        <>
                          <Sparkles size={14} />
                          Installing…
                        </>
                      ) : installed ? (
                        <>
                          <Download size={14} />
                          Installed
                        </>
                      ) : (
                        <>
                          <Download size={14} />
                          Install
                        </>
                      )}
                    </PrimaryButton>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[color:var(--border)] px-3 py-4 text-[12px] text-[color:var(--muted)]">
            No pi packages match that search.
          </div>
        )}

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
      </section>
    </div>
  );
}
