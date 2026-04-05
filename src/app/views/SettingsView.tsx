import { Check, ChevronDown, GitCommitHorizontal, Github, LoaderCircle, Plus } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { ComposerMenu } from "../components/workspace/composer/ComposerMenu";
import type { DesktopAction } from "../desktop/actions";
import type {
  AppSettings,
  ComposerModel,
  DesktopActionResult,
  ProjectImportCandidate,
} from "../desktop/types";
import { useAnimatedPresence } from "../hooks/useAnimatedPresence";
import { useDismissibleLayer } from "../hooks/useDismissibleLayer";
import {
  primaryButtonClass,
  settingsInputClass,
  settingsListRowClass,
  settingsSectionClass,
  settingsSelectButtonClass,
} from "../ui/classes";
import { cn } from "../utils/cn";

function getActionError(result: DesktopActionResult | null) {
  return typeof result?.result?.error === "string" ? result.result.error : null;
}

function isProjectImportCandidate(value: unknown): value is ProjectImportCandidate {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.projectId === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.isGitRepo === "boolean" &&
    typeof candidate.hasOrigin === "boolean" &&
    (candidate.originUrl === null || typeof candidate.originUrl === "string") &&
    typeof candidate.alreadyImported === "boolean"
  );
}

function getProjectImportCandidates(result: DesktopActionResult | null) {
  const projects = result?.result?.projects;
  return Array.isArray(projects) ? projects.filter(isProjectImportCandidate) : [];
}

type SettingsViewProps = {
  appSettings: AppSettings;
  availableModels: ComposerModel[];
  currentModel: ComposerModel | null;
  onAction: (
    action: DesktopAction,
    payload?: Record<string, unknown>,
  ) => Promise<DesktopActionResult | null>;
};

export function SettingsView({
  appSettings,
  availableModels,
  currentModel,
  onAction,
}: SettingsViewProps) {
  const selectedModel = appSettings.gitCommitMessageModel;
  const favoriteFolders = appSettings.favoriteFolders;
  const projectScanRoots = appSettings.projectScanRoots;
  const [menuOpen, setMenuOpen] = useState(false);
  const [favoriteFolderDraft, setFavoriteFolderDraft] = useState("");
  const [scanRootDraft, setScanRootDraft] = useState("");
  const [scanBusy, setScanBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importCandidates, setImportCandidates] = useState<ProjectImportCandidate[]>([]);
  const [selectedImportProjectIds, setSelectedImportProjectIds] = useState<string[]>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuPresent = useAnimatedPresence(menuOpen);
  const menuId = "settings-git-commit-model-menu";

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  useDismissibleLayer({
    open: menuOpen,
    onDismiss: closeMenu,
    refs: [buttonRef, panelRef],
  });

  const currentValue = selectedModel
    ? `${selectedModel.provider}/${selectedModel.id}`
    : "Use composer model";

  const updateFavoriteFolders = (nextFavoriteFolders: string[]) => {
    onAction("settings.update", {
      key: "favoriteFolders",
      folders: nextFavoriteFolders,
    });
  };

  const addFavoriteFolder = () => {
    const nextFavoriteFolder = favoriteFolderDraft.trim();
    if (!nextFavoriteFolder) {
      return;
    }

    updateFavoriteFolders([...favoriteFolders, nextFavoriteFolder]);
    setFavoriteFolderDraft("");
  };

  const updateProjectScanRoots = (nextRoots: string[]) => {
    void onAction("settings.update", {
      key: "projectScanRoots",
      roots: nextRoots,
    });
  };

  const addProjectScanRoot = () => {
    const nextScanRoot = scanRootDraft.trim();
    if (!nextScanRoot) {
      return;
    }

    updateProjectScanRoots([...projectScanRoots, nextScanRoot]);
    setScanRootDraft("");
  };

  const handleSelect = (id: string) => {
    if (id === "composer-default") {
      onAction("settings.update", { key: "gitCommitMessageModel", reset: true });
      closeMenu();
      return;
    }

    const [provider, ...modelIdParts] = id.split("/");
    onAction("settings.update", {
      key: "gitCommitMessageModel",
      provider,
      modelId: modelIdParts.join("/"),
    });
    closeMenu();
  };

  const handleScanProjects = async () => {
    const rootsToScan = projectScanRoots.length > 0 ? projectScanRoots : favoriteFolders;
    if (rootsToScan.length === 0) {
      setImportError("Add at least one scan root before scanning for projects.");
      setImportMessage(null);
      return;
    }

    setScanBusy(true);
    setImportError(null);
    setImportMessage(null);

    try {
      const result = await onAction("projects.import.scan", { roots: rootsToScan });
      const errorMessage = getActionError(result);
      if (errorMessage) {
        setImportError(errorMessage);
        setImportCandidates([]);
        setSelectedImportProjectIds([]);
        return;
      }

      const nextCandidates = getProjectImportCandidates(result);
      setImportCandidates(nextCandidates);
      setSelectedImportProjectIds(
        nextCandidates
          .filter((candidate) => !candidate.alreadyImported)
          .map((candidate) => candidate.projectId),
      );
      setImportMessage(
        nextCandidates.length > 0
          ? `Found ${nextCandidates.length} importable git ${nextCandidates.length === 1 ? "project" : "projects"}.`
          : "No git projects found in those roots.",
      );
    } finally {
      setScanBusy(false);
    }
  };

  const handleImportProjects = async () => {
    const selectedProjects = importCandidates
      .filter((candidate) => selectedImportProjectIds.includes(candidate.projectId))
      .map((candidate) => ({
        projectId: candidate.projectId,
        originUrl: candidate.originUrl,
      }));

    if (selectedProjects.length === 0) {
      setImportError("Select at least one project to import.");
      return;
    }

    setImportBusy(true);
    setImportError(null);

    try {
      const result = await onAction("projects.import.apply", { projects: selectedProjects });
      const errorMessage = getActionError(result);
      if (errorMessage) {
        setImportError(errorMessage);
        return;
      }

      setImportCandidates((currentCandidates) =>
        currentCandidates.map((candidate) =>
          selectedImportProjectIds.includes(candidate.projectId)
            ? { ...candidate, alreadyImported: true }
            : candidate,
        ),
      );
      setSelectedImportProjectIds([]);
      setImportMessage(
        `Imported ${selectedProjects.length} ${selectedProjects.length === 1 ? "project" : "projects"}. You can rescan these roots anytime for new ones.`,
      );
    } finally {
      setImportBusy(false);
    }
  };

  return (
    <div className="mx-auto grid h-full w-full max-w-[760px] content-start gap-4 px-2 pt-6 pb-6">
      <div className="grid gap-1">
        <h1 className="m-0 text-[18px] font-medium text-[color:var(--text)]">Settings</h1>
        <p className="m-0 text-[13px] text-[color:var(--muted)]">
          Git commit model, import roots, and favorite folders.
        </p>
      </div>

      <section className={cn(settingsSectionClass, "gap-2")}>
        <div className="relative">
          <button
            ref={buttonRef}
            type="button"
            className={settingsSelectButtonClass}
            onClick={() => setMenuOpen((current) => !current)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuId}
          >
            <div className="grid min-w-0 grid-cols-[16px_minmax(0,1fr)] items-center gap-3">
              <GitCommitHorizontal size={16} className="text-[color:var(--muted)]" />
              <div className="min-w-0">
                <div className="truncate text-[13px] text-[color:var(--muted)]">
                  Git commit message model
                </div>
                <div className="truncate text-[14px] text-[color:var(--text)]">{currentValue}</div>
              </div>
            </div>
            <ChevronDown
              size={14}
              className={cn(
                "text-[color:var(--muted)] transition-transform",
                menuOpen && "rotate-180",
              )}
            />
          </button>

          {menuPresent ? (
            <ComposerMenu
              items={[
                {
                  id: "composer-default",
                  label: "Use composer model",
                  description: currentModel
                    ? `${currentModel.provider}/${currentModel.id}`
                    : "No active composer model",
                  selected: !selectedModel,
                },
                ...availableModels.map((model) => ({
                  id: `${model.provider}/${model.id}`,
                  label: `${model.provider}/${model.id}`,
                  selected:
                    selectedModel?.provider === model.provider && selectedModel.id === model.id,
                })),
              ]}
              menuId={menuId}
              panelRef={panelRef}
              onSelect={handleSelect}
              widthClassName="top-[calc(100%+8px)] bottom-auto left-0 w-full max-h-80 overflow-y-auto"
            />
          ) : null}
        </div>
      </section>

      <section className={settingsSectionClass}>
        <div className="grid gap-1">
          <h2 className="m-0 text-[15px] font-medium text-[color:var(--text)]">Project import</h2>
          <p className="m-0 text-[13px] text-[color:var(--muted)]">
            Scan a few root folders for git repositories, review what was found, then import only
            the projects you want. You can rerun this later to pick up new repos.
          </p>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={scanRootDraft}
            onChange={(event) => setScanRootDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addProjectScanRoot();
              }
            }}
            className={settingsInputClass}
            placeholder="Paste a folder to scan for git repos"
            aria-label="Project import root"
          />
          <button
            type="button"
            className={cn(
              primaryButtonClass,
              "inline-flex items-center gap-1.5 px-3 disabled:cursor-not-allowed disabled:opacity-45",
            )}
            onClick={addProjectScanRoot}
            disabled={scanRootDraft.trim().length === 0}
          >
            <Plus size={14} />
            Add root
          </button>
        </div>

        <div className="grid gap-2">
          {projectScanRoots.length > 0 ? (
            projectScanRoots.map((projectScanRoot) => (
              <div key={projectScanRoot} className={settingsListRowClass}>
                <div
                  className="truncate text-[13px] text-[color:var(--text)]"
                  title={projectScanRoot}
                >
                  {projectScanRoot}
                </div>
                <button
                  type="button"
                  className="text-[12px] text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)]"
                  onClick={() =>
                    updateProjectScanRoots(
                      projectScanRoots.filter((currentRoot) => currentRoot !== projectScanRoot),
                    )
                  }
                >
                  Remove
                </button>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-[color:var(--border)] px-3 py-4 text-[12px] text-[color:var(--muted)]">
              No scan roots yet. Add one or more folders to search for projects.
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className={cn(
              primaryButtonClass,
              "inline-flex items-center gap-2 px-3 disabled:cursor-not-allowed disabled:opacity-45",
            )}
            onClick={() => {
              void handleScanProjects();
            }}
            disabled={scanBusy}
          >
            {scanBusy ? <LoaderCircle size={14} className="animate-spin" /> : null}
            {scanBusy ? "Scanning…" : "Scan for projects"}
          </button>
          {appSettings.projectImportState === false ? (
            <button
              type="button"
              className="text-[12px] text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)]"
              onClick={() => {
                void onAction("settings.update", {
                  key: "projectImportState",
                  imported: null,
                });
              }}
            >
              Re-enable import reminder
            </button>
          ) : null}
        </div>

        {importMessage ? (
          <div className="text-[12px] text-[color:var(--muted)]">{importMessage}</div>
        ) : null}
        {importError ? <div className="text-[12px] text-[#f2a7a7]">{importError}</div> : null}

        {importCandidates.length > 0 ? (
          <div className="grid gap-2 rounded-[18px] border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="grid gap-0.5">
                <div className="text-[13px] font-medium text-[color:var(--text)]">Scan results</div>
                <div className="text-[12px] text-[color:var(--muted)]">
                  Imported projects are marked and won’t be selected by default.
                </div>
              </div>
              <button
                type="button"
                className={cn(
                  primaryButtonClass,
                  "inline-flex items-center gap-2 px-3 disabled:cursor-not-allowed disabled:opacity-45",
                )}
                onClick={() => {
                  void handleImportProjects();
                }}
                disabled={importBusy}
              >
                {importBusy ? <LoaderCircle size={14} className="animate-spin" /> : null}
                {importBusy ? "Importing…" : "Import selected"}
              </button>
            </div>

            <div className="grid gap-2">
              {importCandidates.map((candidate) => {
                const selected = selectedImportProjectIds.includes(candidate.projectId);

                return (
                  <label
                    key={candidate.projectId}
                    className={cn(
                      settingsListRowClass,
                      "grid-cols-[auto_minmax(0,1fr)] rounded-2xl py-3",
                      selected && "border-[rgba(183,186,245,0.24)] bg-[rgba(183,186,245,0.08)]",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={selected}
                      disabled={candidate.alreadyImported}
                      onChange={(event) => {
                        setSelectedImportProjectIds((currentProjectIds) =>
                          event.target.checked
                            ? [...currentProjectIds, candidate.projectId]
                            : currentProjectIds.filter(
                                (currentProjectId) => currentProjectId !== candidate.projectId,
                              ),
                        );
                      }}
                    />
                    <div className="grid min-w-0 gap-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-[13px] font-medium text-[color:var(--text)]">
                          {candidate.name}
                        </span>
                        {candidate.alreadyImported ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(255,255,255,0.06)] px-2 py-0.5 text-[11px] text-[color:var(--muted)]">
                            <Check size={11} />
                            Imported
                          </span>
                        ) : null}
                        {candidate.hasOrigin ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(255,255,255,0.06)] px-2 py-0.5 text-[11px] text-[color:var(--muted)]">
                            <Github size={11} />
                            Origin
                          </span>
                        ) : null}
                      </div>
                      <div
                        className="truncate text-[12px] text-[color:var(--muted)]"
                        title={candidate.projectId}
                      >
                        {candidate.projectId}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>

      <section className={settingsSectionClass}>
        <div className="grid gap-1">
          <h2 className="m-0 text-[15px] font-medium text-[color:var(--text)]">Favorite folders</h2>
          <p className="m-0 text-[13px] text-[color:var(--muted)]">
            The attachment picker always shows Home plus the favorite folders you add here.
          </p>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={favoriteFolderDraft}
            onChange={(event) => setFavoriteFolderDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addFavoriteFolder();
              }
            }}
            className={settingsInputClass}
            placeholder="Paste an absolute folder path"
            aria-label="Favorite folder path"
          />
          <button
            type="button"
            className={cn(
              primaryButtonClass,
              "px-3 disabled:cursor-not-allowed disabled:opacity-45",
            )}
            onClick={addFavoriteFolder}
            disabled={favoriteFolderDraft.trim().length === 0}
          >
            Add
          </button>
        </div>

        <div className="grid gap-2">
          {favoriteFolders.length > 0 ? (
            favoriteFolders.map((favoriteFolder) => (
              <div key={favoriteFolder} className={settingsListRowClass}>
                <div
                  className="truncate text-[13px] text-[color:var(--text)]"
                  title={favoriteFolder}
                >
                  {favoriteFolder}
                </div>
                <button
                  type="button"
                  className="text-[12px] text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)]"
                  onClick={() =>
                    updateFavoriteFolders(
                      favoriteFolders.filter((currentFolder) => currentFolder !== favoriteFolder),
                    )
                  }
                >
                  Remove
                </button>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-[color:var(--border)] px-3 py-4 text-[12px] text-[color:var(--muted)]">
              No favorite folders yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
