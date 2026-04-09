import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { PiConfiguredPackage } from "../../../desktop/types";
import {
  desktopQueryKeys,
  getConfiguredPiPackagesQuery,
  installPiPackageQuery,
  removePiPackageQuery,
  searchPiPackagesQuery,
} from "../../../query/desktop-query";
import type { ExtensionsViewProps, InstallScope, ManualSourceKind, PendingAction } from "../types";
import { getActionError, getInstalledIdentityKeys, isDesktopPackagesAvailable } from "../utils";

export function useExtensionsController({
  projectPath,
  onSetProjectScopeActive,
}: ExtensionsViewProps) {
  const queryClient = useQueryClient();
  const normalizedProjectPath = projectPath?.trim() ? projectPath : null;
  const [searchInput, setSearchInput] = useState("");
  const [manualSource, setManualSource] = useState("");
  const [manualSourceKind, setManualSourceKind] = useState<ManualSourceKind>("npm");
  const [installScope, setInstallScope] = useState<InstallScope>("global");
  const [installedOpen, setInstalledOpen] = useState(true);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [selectedCatalogSources, setSelectedCatalogSources] = useState<string[]>([]);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const deferredSearchInput = useDeferredValue(searchInput.trim());
  const desktopPackagesAvailable = isDesktopPackagesAvailable();
  const projectScopeAvailable = normalizedProjectPath !== null;

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
  const scopedConfiguredEntries = useMemo(
    () =>
      configuredPackages.filter((configuredPackage) =>
        installScope === "project"
          ? configuredPackage.scope === "project"
          : configuredPackage.scope === "user",
      ),
    [configuredPackages, installScope],
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
    () => getInstalledIdentityKeys(scopedInstalledEntries),
    [scopedInstalledEntries],
  );
  const catalogItems = useMemo(
    () => packagesQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [packagesQuery.data?.pages],
  );

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

    void queryClient.invalidateQueries({
      queryKey: ["desktop", "piPackages", "configured"],
    });
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
  const manualInstallPending = hasManualSource && isPending("install", manualSource);

  const handleInstall = async (source: string, kind: ManualSourceKind) => {
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

  const handleManualInstall = async () => {
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

  const toggleCatalogSource = (source: string) => {
    setSelectedCatalogSources((current) => {
      if (current.includes(source)) {
        return current.filter((selectedSource) => selectedSource !== source);
      }

      return [...current, source];
    });
  };

  return {
    actionError,
    browseOpen,
    catalogError: packagesQuery.isError ? getActionError(packagesQuery.error) : null,
    catalogItems,
    catalogLoading: packagesQuery.isLoading,
    desktopPackagesAvailable,
    hasManualSource,
    hasNextCatalogPage: Boolean(packagesQuery.hasNextPage),
    hasPendingInstall,
    hasSelectedCatalogSources,
    installScope,
    installedIdentityKeys,
    installedOpen,
    isFetchingNextCatalogPage: packagesQuery.isFetchingNextPage,
    isInstallPending: (source: string) => isPending("install", source),
    isRemovePending: (source: string) => isPending("remove", source),
    manualInstallPending,
    manualSource,
    manualSourceKind,
    projectScopeAvailable,
    scopedInstalledEntries: scopedConfiguredEntries,
    searchInput,
    selectedCatalogSources,
    setBrowseOpen,
    setInstallScope,
    setInstalledOpen,
    setManualSource,
    setManualSourceKind,
    setSearchInput,
    handleManualInstall,
    handleRemove,
    handleSelectedCatalogInstall,
    loadMoreCatalog: () => void packagesQuery.fetchNextPage(),
    toggleCatalogSource,
  };
}
