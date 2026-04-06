import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Download,
  ExternalLink,
  GitBranch,
  PackagePlus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  type FormEvent,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PiConfiguredPackage, PiPackageCatalogItem } from "../../desktop/types";
import {
  desktopQueryKeys,
  getConfiguredPiPackagesQuery,
  installPiPackageQuery,
  removePiPackageQuery,
  searchPiPackagesQuery,
} from "../../query/desktop-query";
import {
  modalPanelClass,
  panelChromeClass,
  settingsInputClass,
  settingsListRowClass,
} from "../../ui/classes";
import { cn } from "../../utils/cn";
import { PrimaryButton } from "../common/PrimaryButton";
import { TextButton } from "../common/TextButton";

type ExtensionsPanelProps = {
  open: boolean;
  onClose: () => void;
};

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

function isDesktopPackagesAvailable() {
  return typeof window !== "undefined" && Boolean(window.piDesktop?.searchPiPackages);
}

async function openExternalUrl(url: string) {
  if (!url) {
    return;
  }

  if (window.piDesktop?.openExternal) {
    await window.piDesktop.openExternal(url);
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

function normalizeExternalUrl(url: string) {
  return url.replace(/^git\+/, "");
}

function getPackageLink(item: PiPackageCatalogItem) {
  return normalizeExternalUrl(item.repositoryUrl ?? item.homepageUrl ?? item.npmUrl);
}

export function ExtensionsPanel({ open, onClose }: ExtensionsPanelProps) {
  const titleId = useId();
  const queryClient = useQueryClient();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [manualSource, setManualSource] = useState("");
  const [manualSourceKind, setManualSourceKind] = useState<"npm" | "git">("npm");
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const deferredSearchInput = useDeferredValue(searchInput.trim());
  const desktopPackagesAvailable = isDesktopPackagesAvailable();

  useEffect(() => {
    if (!open) {
      return;
    }

    lastFocusedElementRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      lastFocusedElementRef.current?.focus();
    };
  }, [onClose, open]);

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
  const configuredPackageIdentityKeys = useMemo(
    () => new Set(configuredPackages.map((configuredPackage) => configuredPackage.identityKey)),
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

  const isPending = (kind: PendingAction["kind"], source: string) =>
    pendingActions.some(
      (action) => action.kind === kind && action.source.toLowerCase() === source.toLowerCase(),
    );

  const handleInstall = async (source: string, kind: "npm" | "git") => {
    const pendingAction = { kind: "install" as const, source };

    addPendingAction(pendingAction);
    setActionError(null);

    try {
      const result = await installPiPackageQuery({ source, kind });
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

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(8,10,18,0.52)] px-6 py-8 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <dialog
        open
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          panelChromeClass,
          modalPanelClass,
          "flex h-full max-h-[760px] w-full max-w-[980px] flex-col overflow-hidden rounded-3xl",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--border)] px-6 py-5">
          <div className="grid gap-1">
            <div id={titleId} className="text-[18px] font-medium text-[color:var(--text)]">
              Extensions
            </div>
            <p className="m-0 text-[13px] text-[color:var(--muted)]">
              Browse popular pi packages from npm, then install from npm or git.
            </p>
          </div>
          <TextButton
            ref={closeButtonRef}
            className="p-1"
            onClick={onClose}
            aria-label="Close extensions dialog"
          >
            <X size={16} />
          </TextButton>
        </div>

        {!desktopPackagesAvailable ? (
          <div className="grid flex-1 place-items-center px-6 text-center text-[13px] text-[color:var(--muted)]">
            <div className="grid max-w-[420px] gap-2">
              <div className="text-[15px] text-[color:var(--text)]">Desktop bridge unavailable</div>
              <p className="m-0">
                Open the desktop build to browse and install extensions from this screen.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-3 border-b border-[color:var(--border)] px-6 py-4">
              <form className="grid gap-2" onSubmit={handleManualInstall}>
                <div className="flex flex-wrap items-center gap-3">
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
                  <div className="text-[12px] text-[color:var(--muted)]">
                    {manualSourceKind === "npm" ? "npm:@scope/pkg" : "github.com/user/repo"}
                  </div>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
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
                    aria-label={
                      manualSourceKind === "npm" ? "Install npm package" : "Install git package"
                    }
                  />
                  <PrimaryButton
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-3 disabled:cursor-not-allowed disabled:opacity-45"
                    disabled={
                      manualSource.trim().length === 0 || isPending("install", manualSource.trim())
                    }
                  >
                    {isPending("install", manualSource.trim()) ? (
                      <>
                        <Sparkles size={14} />
                        Installing…
                      </>
                    ) : (
                      <>
                        {manualSourceKind === "npm" ? (
                          <PackagePlus size={14} />
                        ) : (
                          <GitBranch size={14} />
                        )}
                        Install
                      </>
                    )}
                  </PrimaryButton>
                </div>
              </form>

              <label className="flex items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] px-3 py-2.5 text-[color:var(--muted)] focus-within:text-[color:var(--text)]">
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

              {actionError ? <div className="text-[12px] text-[#f2a7a7]">{actionError}</div> : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <div className="grid gap-5">
                <section className="grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[13px] font-medium text-[color:var(--text)]">
                      Installed
                    </div>
                    <div className="text-[12px] text-[color:var(--muted)]">
                      {configuredPackages.length} configured
                    </div>
                  </div>

                  {configuredPackages.length > 0 ? (
                    <div className="grid gap-2">
                      {configuredPackages.map((configuredPackage) => (
                        <div
                          key={`${configuredPackage.scope}:${configuredPackage.source}`}
                          className={settingsListRowClass}
                        >
                          <div className="min-w-0 grid gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="truncate text-[13px] text-[color:var(--text)]">
                                {configuredPackage.displayName}
                              </div>
                              <span className="rounded-full border border-[color:var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-[color:var(--muted)]">
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
                    <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-5 text-[12px] text-[color:var(--muted)]">
                      No packages installed yet.
                    </div>
                  )}
                </section>

                <section className="grid gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="grid gap-0.5">
                      <div className="text-[13px] font-medium text-[color:var(--text)]">
                        Popular on npm
                      </div>
                      <div className="text-[12px] text-[color:var(--muted)]">
                        {totalPackages > 0
                          ? `${compactNumberFormatter.format(totalPackages)} packages • most downloaded first`
                          : "Searching npm…"}
                      </div>
                    </div>
                  </div>

                  {packagesQuery.isLoading ? (
                    <div className="rounded-2xl border border-[color:var(--border)] px-4 py-5 text-[12px] text-[color:var(--muted)]">
                      Loading packages…
                    </div>
                  ) : packagesQuery.isError ? (
                    <div className="rounded-2xl border border-[color:var(--border)] px-4 py-5 text-[12px] text-[#f2a7a7]">
                      {getActionError(packagesQuery.error)}
                    </div>
                  ) : catalogItems.length > 0 ? (
                    <div className="grid gap-2">
                      {catalogItems.map((item) => {
                        const installed = configuredPackageIdentityKeys.has(item.identityKey);
                        const pendingInstall = isPending("install", item.source);
                        const publishedAt = formatPublishedAt(item.publishedAt);

                        return (
                          <div
                            key={item.name}
                            className="grid gap-3 rounded-2xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] px-4 py-3"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0 grid gap-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="truncate text-[14px] font-medium text-[color:var(--text)]">
                                    {item.name}
                                  </div>
                                  {installed ? (
                                    <span className="rounded-full border border-[rgba(134,217,160,0.24)] bg-[rgba(134,217,160,0.1)] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-[color:var(--green)]">
                                      Installed
                                    </span>
                                  ) : null}
                                </div>

                                {item.description ? (
                                  <p className="m-0 text-[12.5px] text-[color:var(--muted)]">
                                    {item.description}
                                  </p>
                                ) : null}
                              </div>

                              <div className="flex shrink-0 items-center gap-1.5">
                                <TextButton
                                  className="p-1.5"
                                  onClick={() => void openExternalUrl(getPackageLink(item))}
                                  aria-label={`Open ${item.name}`}
                                >
                                  <ExternalLink size={14} />
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

                            <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-[color:var(--muted)]">
                              <span className="rounded-full border border-[color:var(--border)] px-2 py-1">
                                {formatDownloads(item.monthlyDownloads)}
                              </span>
                              <span className="rounded-full border border-[color:var(--border)] px-2 py-1">
                                v{item.version}
                              </span>
                              {publishedAt ? (
                                <span className="rounded-full border border-[color:var(--border)] px-2 py-1">
                                  {publishedAt}
                                </span>
                              ) : null}
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border)] px-2 py-1 text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)]"
                                onClick={() =>
                                  void openExternalUrl(normalizeExternalUrl(item.npmUrl))
                                }
                              >
                                npm
                                <ArrowUpRight size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-5 text-[12px] text-[color:var(--muted)]">
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
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
