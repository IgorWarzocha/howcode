import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  CornerDownLeft,
  FilePenLine,
  FolderOpen,
  PackagePlus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { FeatureStatusBadge } from "../components/common/FeatureStatusBadge";
import { SurfacePanel } from "../components/common/SurfacePanel";
import { TextButton } from "../components/common/TextButton";
import { Tooltip } from "../components/common/Tooltip";
import type { AppSettings, DesktopActionResult, PiConfiguredSkill } from "../desktop/types";
import { useDismissibleLayer } from "../hooks/useDismissibleLayer";
import {
  closeSkillCreatorSessionQuery,
  continueSkillCreatorSessionQuery,
  desktopQueryKeys,
  getConfiguredPiSkillsQuery,
  installPiSkillQuery,
  removePiSkillQuery,
  searchPiSkillsQuery,
  startSkillCreatorSessionQuery,
} from "../query/desktop-query";
import { popoverPanelClass, settingsInputClass, settingsListRowClass } from "../ui/classes";
import { cn } from "../utils/cn";

type SkillsViewProps = {
  appSettings: AppSettings;
  projectPath: string | null;
  onSetProjectScopeActive: (active: boolean) => void;
  onAction: (
    action: "settings.update",
    payload?: Record<string, unknown>,
  ) => Promise<DesktopActionResult | null>;
};

type PendingAction = {
  kind: "install" | "remove";
  source: string;
};

const compactNumberFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const MOCK_SKILL_CREATOR_SOURCE = "skills.sh/skill-creator";

function getActionError(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function formatInstalls(installs: number) {
  return `${compactNumberFormatter.format(installs)} installs`;
}

function isDesktopSkillsAvailable() {
  return typeof window !== "undefined" && Boolean(window.piDesktop?.searchPiSkills);
}

async function openExternalUrl(url: string) {
  if (window.piDesktop?.openExternal) {
    await window.piDesktop.openExternal(url);
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

function getInstalledIdentityKeys(skills: PiConfiguredSkill[]) {
  return new Set(skills.map((skill) => skill.identityKey));
}

function getSkillCreatorDetectionText(skill: PiConfiguredSkill) {
  return [
    skill.displayName,
    skill.description,
    skill.identityKey,
    skill.source,
    skill.installedPath,
    skill.skillFilePath,
    skill.sourceRepo,
    skill.sourceUrl,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isSkillCreatorCandidate(skill: PiConfiguredSkill) {
  const normalized = getSkillCreatorDetectionText(skill);

  if (!normalized) {
    return false;
  }

  const creatorPatterns = [
    /\bskill(?:s)?\s*(?:creator|create|creation|maker|making|author|authoring|builder|build|craft(?:er)?|smith)\b/i,
    /\b(?:creator|create|creation|maker|making|author|authoring|builder|build|craft(?:er)?|smith)\s*skill(?:s)?\b/i,
    /\b(?:create|build|author|make|craft)\s+skills?\b/i,
  ];

  if (creatorPatterns.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  const tokens = new Set(normalized.split(/\s+/).filter(Boolean));
  const hasSkillToken = tokens.has("skill") || tokens.has("skills");
  const hasCreatorToken = [
    "create",
    "creator",
    "creation",
    "maker",
    "making",
    "author",
    "authoring",
    "builder",
    "build",
    "craft",
    "crafter",
    "smith",
  ].some((token) => tokens.has(token));

  return hasSkillToken && hasCreatorToken;
}

export function SkillsView({
  appSettings,
  projectPath,
  onSetProjectScopeActive,
  onAction,
}: SkillsViewProps) {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [submittedSearchInput, setSubmittedSearchInput] = useState("");
  const [manualSource, setManualSource] = useState("");
  const [installScope, setInstallScope] = useState<"global" | "project">("global");
  const [installedOpen, setInstalledOpen] = useState(true);
  const [browseOpen, setBrowseOpen] = useState(true);
  const [confirmRemovePath, setConfirmRemovePath] = useState<string | null>(null);
  const [selectedCatalogSources, setSelectedCatalogSources] = useState<string[]>([]);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [mockSkillCreatorInstalled, setMockSkillCreatorInstalled] = useState(false);
  const [createSkillDraft, setCreateSkillDraft] = useState("");
  const [skillCreatorSessionId, setSkillCreatorSessionId] = useState<string | null>(null);
  const [skillCreatorLatestResponse, setSkillCreatorLatestResponse] = useState<string | null>(null);
  const [createdSkillPath, setCreatedSkillPath] = useState<string | null>(null);
  const [skillCreatorBusy, setSkillCreatorBusy] = useState(false);
  const desktopSkillsAvailable = isDesktopSkillsAvailable();
  const confirmRemoveButtonRef = useRef<HTMLButtonElement>(null);
  const confirmRemovePanelRef = useRef<HTMLDivElement>(null);

  useDismissibleLayer({
    open: confirmRemovePath !== null,
    onDismiss: () => setConfirmRemovePath(null),
    refs: [confirmRemoveButtonRef, confirmRemovePanelRef],
  });

  const configuredSkillsQuery = useQuery({
    queryKey: desktopQueryKeys.configuredPiSkills(projectPath),
    queryFn: () => getConfiguredPiSkillsQuery({ projectPath }),
    staleTime: 30_000,
    enabled: desktopSkillsAvailable,
  });

  const skillsQuery = useQuery({
    queryKey: desktopQueryKeys.piSkillCatalog(submittedSearchInput),
    queryFn: () =>
      searchPiSkillsQuery({
        query: submittedSearchInput,
        limit: 12,
      }),
    staleTime: 5 * 60_000,
    enabled: desktopSkillsAvailable && browseOpen && submittedSearchInput.length >= 2,
  });

  const configuredSkills = configuredSkillsQuery.data ?? [];
  const activeScope = installScope === "project" ? "project" : "user";
  const globalSkillCount = configuredSkills.filter((skill) => skill.scope === "user").length;
  const projectSkillCount = configuredSkills.filter((skill) => skill.scope === "project").length;
  const hasGlobalSkillCreator = configuredSkills.some(
    (skill) => skill.scope === "user" && isSkillCreatorCandidate(skill),
  );
  const skillCreatorReady = hasGlobalSkillCreator || mockSkillCreatorInstalled;
  const visibleConfiguredSkills = useMemo(
    () => configuredSkills.filter((skill) => skill.scope === activeScope),
    [activeScope, configuredSkills],
  );
  const installedIdentityKeys = useMemo(
    () => getInstalledIdentityKeys(visibleConfiguredSkills),
    [visibleConfiguredSkills],
  );
  const catalogItems = skillsQuery.data?.items ?? [];

  useEffect(() => {
    onSetProjectScopeActive(installScope === "project");

    return () => {
      onSetProjectScopeActive(false);
    };
  }, [installScope, onSetProjectScopeActive]);

  useEffect(() => {
    setSelectedCatalogSources((current) =>
      current.filter((source) => {
        const item = catalogItems.find((catalogItem) => catalogItem.identityKey === source);
        return item ? !installedIdentityKeys.has(item.identityKey) : false;
      }),
    );
  }, [catalogItems, installedIdentityKeys]);

  useEffect(() => {
    return () => {
      if (skillCreatorSessionId) {
        void closeSkillCreatorSessionQuery(skillCreatorSessionId);
      }
    };
  }, [skillCreatorSessionId]);

  const invalidateConfiguredSkillsCaches = (skills?: PiConfiguredSkill[]) => {
    if (skills) {
      queryClient.setQueryData(desktopQueryKeys.configuredPiSkills(projectPath), skills);
    }

    void queryClient.invalidateQueries({
      queryKey: ["desktop", "piSkills", "configured"],
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
  const normalizedSearchInput = searchInput.trim();

  const handleSubmitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmittedSearchInput(normalizedSearchInput);
  };

  const handleInstall = async (source: string) => {
    const normalizedSource = source.trim();
    const pendingAction = { kind: "install" as const, source: normalizedSource };

    addPendingAction(pendingAction);
    setActionError(null);

    try {
      const result = await installPiSkillQuery({
        source: normalizedSource,
        local: installScope === "project",
        projectPath,
      });

      if (result?.configuredSkills) {
        invalidateConfiguredSkillsCaches(result.configuredSkills);
      }

      return true;
    } catch (error) {
      setActionError(getActionError(error));
      return false;
    } finally {
      removePendingAction(pendingAction);
    }
  };

  const handleInstallMockSkillCreator = async () => {
    const pendingAction = { kind: "install" as const, source: MOCK_SKILL_CREATOR_SOURCE };

    addPendingAction(pendingAction);
    setActionError(null);

    try {
      setMockSkillCreatorInstalled(true);
    } finally {
      removePendingAction(pendingAction);
    }
  };

  const handleUseOwnSkillCreator = async () => {
    await configuredSkillsQuery.refetch();
  };

  const handleSubmitCreateSkill = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const prompt = createSkillDraft.trim();
    if (!prompt || skillCreatorBusy) {
      return;
    }

    setSkillCreatorBusy(true);
    setActionError(null);

    try {
      const sessionState = skillCreatorSessionId
        ? await continueSkillCreatorSessionQuery({
            sessionId: skillCreatorSessionId,
            prompt,
          })
        : await startSkillCreatorSessionQuery({
            prompt,
            local: installScope === "project",
            projectPath,
          });

      if (!sessionState) {
        throw new Error("Could not start the skill creator.");
      }

      setSkillCreatorSessionId(sessionState.sessionId);
      setSkillCreatorLatestResponse(sessionState.latestResponse);
      setCreatedSkillPath(sessionState.createdSkillPath);
      setCreateSkillDraft("");
      invalidateConfiguredSkillsCaches();
    } catch (error) {
      setActionError(getActionError(error));
    } finally {
      setSkillCreatorBusy(false);
    }
  };

  const handleToggleUseAgentsSkillsPaths = () => {
    void onAction("settings.update", {
      key: "useAgentsSkillsPaths",
      value: !appSettings.useAgentsSkillsPaths,
    });
  };

  const handleRemove = async (configuredSkill: PiConfiguredSkill) => {
    const pendingAction = { kind: "remove" as const, source: configuredSkill.installedPath };

    addPendingAction(pendingAction);
    setActionError(null);
    setConfirmRemovePath(null);

    try {
      const result = await removePiSkillQuery({
        installedPath: configuredSkill.installedPath,
        projectPath,
      });

      if (result?.configuredSkills) {
        invalidateConfiguredSkillsCaches(result.configuredSkills);
      }
    } catch (error) {
      setActionError(getActionError(error));
    } finally {
      removePendingAction(pendingAction);
    }
  };

  const handleManualInstall = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const installSources: string[] = [];
    const seenSources = new Set<string>();
    const manualSourceValue = manualSource.trim();

    if (manualSourceValue) {
      installSources.push(manualSourceValue);
      seenSources.add(manualSourceValue.trim().toLowerCase());
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
      const installed = await handleInstall(source);
      if (installed) {
        successfulSources.add(source.trim().toLowerCase());
      }
    }

    if (manualSourceValue && successfulSources.has(manualSourceValue.trim().toLowerCase())) {
      setManualSource("");
    }

    if (successfulSources.size > 0) {
      setSelectedCatalogSources([]);
    }
  };

  const installedSectionContent =
    visibleConfiguredSkills.length > 0 ? (
      <div className="grid gap-2">
        {visibleConfiguredSkills.map((configuredSkill) => (
          <div
            key={`${configuredSkill.scope}:${configuredSkill.installedPath}`}
            className={cn(settingsListRowClass, "gap-2 py-2")}
          >
            <div className="min-w-0 grid gap-0.5">
              <div className="flex items-center gap-2">
                <div className="truncate text-[13px] text-[color:var(--text)]">
                  {configuredSkill.displayName}
                </div>
                <span className="text-[11px] text-[color:var(--muted)]">
                  {configuredSkill.scope === "project" ? "project" : "global"}
                </span>
                {configuredSkill.provenance === "local" ? (
                  <span className="text-[11px] text-[color:var(--muted)]">Custom</span>
                ) : null}
              </div>
              <div className="truncate text-[12px] text-[color:var(--muted)]">
                {configuredSkill.description ||
                  configuredSkill.sourceRepo ||
                  configuredSkill.source}
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Tooltip content="Open SKILL.md in default editor">
                <TextButton
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full px-0 text-[color:var(--muted)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]"
                  onClick={() => void window.piDesktop?.openPath?.(configuredSkill.skillFilePath)}
                  aria-label="Open SKILL.md in default editor"
                >
                  <FilePenLine size={13} />
                </TextButton>
              </Tooltip>
              <div className="relative">
                <Tooltip
                  content={
                    isPending("remove", configuredSkill.installedPath) ? "Removing" : "Remove"
                  }
                >
                  <TextButton
                    ref={
                      confirmRemovePath === configuredSkill.installedPath
                        ? confirmRemoveButtonRef
                        : undefined
                    }
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full px-0 text-[color:var(--muted)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#ffb4b4]"
                    onClick={() => {
                      if (isPending("remove", configuredSkill.installedPath)) {
                        return;
                      }

                      setConfirmRemovePath((current) =>
                        current === configuredSkill.installedPath
                          ? null
                          : configuredSkill.installedPath,
                      );
                    }}
                    disabled={isPending("remove", configuredSkill.installedPath)}
                    aria-label={
                      isPending("remove", configuredSkill.installedPath) ? "Removing" : "Remove"
                    }
                  >
                    <Trash2 size={13} />
                  </TextButton>
                </Tooltip>

                {confirmRemovePath === configuredSkill.installedPath ? (
                  <SurfacePanel
                    ref={confirmRemovePanelRef}
                    className={cn(
                      "motion-popover absolute top-[calc(100%+6px)] right-0 z-20 flex items-center gap-1 rounded-xl p-1",
                      popoverPanelClass,
                    )}
                    data-open="true"
                  >
                    <button
                      type="button"
                      className="rounded-md px-1.5 py-0.5 text-[10.5px] font-medium text-[#ffb4b4] transition-colors hover:bg-[rgba(255,120,120,0.14)]"
                      onClick={() => void handleRemove(configuredSkill)}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      className="rounded-md px-1.5 py-0.5 text-[10.5px] text-[color:var(--muted)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]"
                      onClick={() => setConfirmRemovePath(null)}
                    >
                      No
                    </button>
                  </SurfacePanel>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="rounded-xl border border-dashed border-[color:var(--border)] px-3 py-4 text-[12px] text-[color:var(--muted)]">
        No {installScope} skills.
      </div>
    );

  const browseSectionContent =
    submittedSearchInput.length < 2 ? (
      <div className="rounded-xl border border-dashed border-[color:var(--border)] px-3 py-4 text-[12px] text-[color:var(--muted)]">
        {normalizedSearchInput.length > 0 && normalizedSearchInput.length < 2
          ? "Type at least 2 characters, then press Enter to search skills from skills.sh."
          : "Press Enter to search skills from skills.sh (min 2 chars)."}
      </div>
    ) : skillsQuery.isLoading ? (
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
          const pendingInstall = isPending("install", `${item.source}@${item.name}`);
          const installLabel = pendingInstall
            ? `Installing ${item.name}`
            : installed
              ? `${item.name} installed`
              : `Install ${item.name}`;

          return (
            <div
              key={item.id}
              className={cn(
                settingsListRowClass,
                "gap-2 py-2",
                selectedCatalogSources.includes(item.identityKey) && "bg-[rgba(255,255,255,0.04)]",
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
                          setSelectedCatalogSources((current) => {
                            if (current.includes(item.identityKey)) {
                              return current.filter((source) => source !== item.identityKey);
                            }

                            return [...current, item.identityKey];
                          });
                        }}
                        aria-pressed={selectedCatalogSources.includes(item.identityKey)}
                        aria-label={installLabel}
                      >
                        <span
                          className={cn(
                            "inline-flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border border-[color:var(--muted-2)] bg-transparent transition-colors",
                            selectedCatalogSources.includes(item.identityKey) &&
                              "border-[rgba(183,186,245,0.42)] text-[color:var(--text)]",
                          )}
                        >
                          {selectedCatalogSources.includes(item.identityKey) ? (
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
        No skills found.
      </div>
    );

  if (!desktopSkillsAvailable) {
    return (
      <div className="mx-auto grid h-full w-full max-w-[860px] content-start gap-4 px-2 pt-6 pb-6">
        <div className="flex items-center gap-1.5">
          <h1 className="m-0 text-[18px] font-medium text-[color:var(--text)]">Skills</h1>
          <span className="text-[12px] text-[color:var(--muted)]">via</span>
          <button
            type="button"
            className="group inline-flex items-center gap-0.5 p-0 text-[12px]"
            onClick={() => void openExternalUrl("https://skills.sh")}
            aria-label="Open skills.sh"
          >
            <span className="text-[color:var(--muted)] transition-colors duration-150 ease-out group-hover:text-[color:var(--accent)]">
              skills.sh
            </span>
            <ArrowUpRight
              size={12}
              className="text-[color:var(--muted)] transition-colors duration-150 ease-out group-hover:text-[color:var(--accent)]"
            />
          </button>
        </div>
        <div className="rounded-xl border border-dashed border-[color:var(--border)] px-3 py-4 text-[12px] text-[color:var(--muted)]">
          Desktop build required.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid h-full w-full max-w-[860px] content-start gap-4 px-2 pt-6 pb-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <h1 className="m-0 text-[18px] font-medium text-[color:var(--text)]">Skills</h1>
          <span className="text-[12px] text-[color:var(--muted)]">via</span>
          <button
            type="button"
            className="group inline-flex items-center gap-0.5 p-0 text-[12px]"
            onClick={() => void openExternalUrl("https://skills.sh")}
            aria-label="Open skills.sh"
          >
            <span className="text-[color:var(--muted)] transition-colors duration-150 ease-out group-hover:text-[color:var(--accent)]">
              skills.sh
            </span>
            <ArrowUpRight
              size={12}
              className="text-[color:var(--muted)] transition-colors duration-150 ease-out group-hover:text-[color:var(--accent)]"
            />
          </button>
        </div>
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
            >
              {scope === "global"
                ? `Global (${globalSkillCount})`
                : `Project (${projectSkillCount})`}
            </button>
          ))}
        </div>
      </div>

      {actionError ? <div className="text-[12px] text-[#f2a7a7]">{actionError}</div> : null}

      <section className="grid gap-2">
        <div className="inline-flex items-center gap-2 text-[13px] font-medium text-[color:var(--text)]">
          <span>Create a skill</span>
          <FeatureStatusBadge statusId="feature:skills.create" />
        </div>

        <div className="rounded-[18px] border border-dashed border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] px-3 py-2.5">
          <div className="grid gap-1.5 text-[12px] leading-5 text-[color:var(--muted)]">
            {skillCreatorReady ? (
              <div className="grid gap-2">
                <div className="px-0.5 py-0.5">
                  {skillCreatorLatestResponse ? (
                    <div className="rounded-xl bg-[rgba(255,255,255,0.03)] px-2.5 py-2 text-[12px] leading-5 text-[color:var(--muted)]">
                      {skillCreatorLatestResponse}
                    </div>
                  ) : (
                    <div className="rounded-xl bg-[rgba(255,255,255,0.03)] px-2.5 py-2 text-[12px] leading-5 text-[color:var(--muted)]">
                      This spawns a temporary chat session. For complex project-skills, please use
                      normal chat for best results.
                    </div>
                  )}
                </div>

                <form
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"
                  onSubmit={handleSubmitCreateSkill}
                >
                  <input
                    type="text"
                    value={createSkillDraft}
                    onChange={(event) => setCreateSkillDraft(event.target.value)}
                    className={settingsInputClass}
                    placeholder="Describe the skill you want"
                    aria-label="Describe the skill you want"
                    disabled={skillCreatorBusy}
                  />
                  <TextButton
                    className="inline-flex h-auto items-center gap-1 rounded-xl px-1.5 py-0 text-[12px]"
                    onClick={() => {
                      if (createdSkillPath) {
                        void window.piDesktop?.openPath?.(createdSkillPath);
                      }
                    }}
                    disabled={!createdSkillPath}
                  >
                    <span>Open folder</span>
                    <FolderOpen size={11} />
                  </TextButton>
                </form>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span>No global skill creator detected. Install the bundled skill creator?</span>
                  <TextButton
                    className="h-auto rounded-md px-1.5 py-0 text-[12px] text-[color:var(--text)]"
                    onClick={() => {
                      void handleInstallMockSkillCreator();
                    }}
                    disabled={isPending("install", MOCK_SKILL_CREATOR_SOURCE)}
                  >
                    {isPending("install", MOCK_SKILL_CREATOR_SOURCE) ? "Installing…" : "Yes"}
                  </TextButton>
                  <TextButton
                    className="inline-flex h-auto items-center gap-1 rounded-md px-1.5 py-0 text-[12px]"
                    onClick={() => {
                      void handleUseOwnSkillCreator();
                    }}
                    disabled={configuredSkillsQuery.isFetching}
                  >
                    <span>No - I have provided my own</span>
                    <RefreshCw
                      size={11}
                      className={configuredSkillsQuery.isFetching ? "animate-spin" : ""}
                    />
                  </TextButton>
                </div>
                <div>
                  Please note this skill creator is agent-agnostic, as opposed to most of the skill
                  creator skills you will find for other harnesses and agents.
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-left text-[13px] font-medium text-[color:var(--text)]"
          onClick={() => setInstalledOpen((current) => !current)}
          aria-expanded={installedOpen}
        >
          {installedOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span>Installed</span>
        </button>

        {installedOpen ? installedSectionContent : null}
      </div>

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
            onClick={handleToggleUseAgentsSkillsPaths}
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
                    (hasManualSource && isPending("install", manualSource))
                  }
                  aria-label={
                    hasManualSource
                      ? "Install skill source"
                      : hasSelectedCatalogSources
                        ? `Install ${selectedCatalogSources.length} selected skills`
                        : "Install skills"
                  }
                >
                  {pendingActions.some((action) => action.kind === "install") ? (
                    <Sparkles size={14} />
                  ) : (
                    <PackagePlus size={14} />
                  )}
                </TextButton>
              </Tooltip>
            </form>

            <form onSubmit={handleSubmitSearch}>
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
    </div>
  );
}
