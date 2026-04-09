import { Check, ChevronDown, FilePenLine, FolderPlus, GitCommitHorizontal } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ComposerMenu } from "../components/workspace/composer/ComposerMenu";
import type {
  AppSettings,
  ComposerModel,
  DesktopActionInvoker,
  DesktopActionResult,
  ModelSelection,
} from "../desktop/types";
import { useAnimatedPresence } from "../hooks/useAnimatedPresence";
import { useDismissibleLayer } from "../hooks/useDismissibleLayer";
import type { Project } from "../types";
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

function getModelSettingValue(selection: ModelSelection | null) {
  return selection ? `${selection.provider}/${selection.id}` : "Use composer model";
}

function buildModelMenuItems(
  selectedModel: ModelSelection | null,
  currentModel: ComposerModel | null,
  availableModels: ComposerModel[],
) {
  return [
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
      selected: selectedModel?.provider === model.provider && selectedModel.id === model.id,
    })),
  ];
}

type SettingsViewProps = {
  appSettings: AppSettings;
  availableModels: ComposerModel[];
  currentModel: ComposerModel | null;
  projects: Project[];
  onAction: DesktopActionInvoker;
};

export function SettingsView({
  appSettings,
  availableModels,
  currentModel,
  projects,
  onAction,
}: SettingsViewProps) {
  const selectedGitCommitModel = appSettings.gitCommitMessageModel;
  const selectedSkillCreatorModel = appSettings.skillCreatorModel;
  const favoriteFolders = appSettings.favoriteFolders;
  const [preferredProjectLocationDraft, setPreferredProjectLocationDraft] = useState(
    appSettings.preferredProjectLocation ?? "",
  );
  const [gitCommitMenuOpen, setGitCommitMenuOpen] = useState(false);
  const [skillCreatorMenuOpen, setSkillCreatorMenuOpen] = useState(false);
  const [favoriteFolderDraft, setFavoriteFolderDraft] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importStatusMessage, setImportStatusMessage] = useState<string | null>(null);
  const [importErrorMessage, setImportErrorMessage] = useState<string | null>(null);
  const gitCommitButtonRef = useRef<HTMLButtonElement>(null);
  const gitCommitPanelRef = useRef<HTMLDivElement>(null);
  const gitCommitMenuPresent = useAnimatedPresence(gitCommitMenuOpen);
  const gitCommitMenuId = "settings-git-commit-model-menu";
  const skillCreatorButtonRef = useRef<HTMLButtonElement>(null);
  const skillCreatorPanelRef = useRef<HTMLDivElement>(null);
  const skillCreatorMenuPresent = useAnimatedPresence(skillCreatorMenuOpen);
  const skillCreatorMenuId = "settings-skill-creator-model-menu";

  useEffect(() => {
    setPreferredProjectLocationDraft(appSettings.preferredProjectLocation ?? "");
  }, [appSettings.preferredProjectLocation]);

  const closeGitCommitMenu = useCallback(() => {
    setGitCommitMenuOpen(false);
  }, []);

  const closeSkillCreatorMenu = useCallback(() => {
    setSkillCreatorMenuOpen(false);
  }, []);

  useDismissibleLayer({
    open: gitCommitMenuOpen,
    onDismiss: closeGitCommitMenu,
    refs: [gitCommitButtonRef, gitCommitPanelRef],
  });

  useDismissibleLayer({
    open: skillCreatorMenuOpen,
    onDismiss: closeSkillCreatorMenu,
    refs: [skillCreatorButtonRef, skillCreatorPanelRef],
  });

  const gitCommitCurrentValue = getModelSettingValue(selectedGitCommitModel);
  const skillCreatorCurrentValue = getModelSettingValue(selectedSkillCreatorModel);

  const updateFavoriteFolders = (nextFavoriteFolders: string[]) => {
    void onAction("settings.update", {
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

  const savePreferredProjectLocation = () => {
    void onAction("settings.update", {
      key: "preferredProjectLocation",
      value: preferredProjectLocationDraft,
    });
  };

  const handleSelectGitCommitModel = (id: string) => {
    if (id === "composer-default") {
      void onAction("settings.update", { key: "gitCommitMessageModel", reset: true });
      closeGitCommitMenu();
      return;
    }

    const [provider, ...modelIdParts] = id.split("/");
    void onAction("settings.update", {
      key: "gitCommitMessageModel",
      provider,
      modelId: modelIdParts.join("/"),
    });
    closeGitCommitMenu();
  };

  const handleSelectSkillCreatorModel = (id: string) => {
    if (id === "composer-default") {
      void onAction("settings.update", { key: "skillCreatorModel", reset: true });
      closeSkillCreatorMenu();
      return;
    }

    const [provider, ...modelIdParts] = id.split("/");
    void onAction("settings.update", {
      key: "skillCreatorModel",
      provider,
      modelId: modelIdParts.join("/"),
    });
    closeSkillCreatorMenu();
  };

  const handleImportProjectUi = async () => {
    setImportBusy(true);
    setImportStatusMessage("Scanning projects for UI info…");
    setImportErrorMessage(null);

    try {
      const result = await onAction("projects.import.apply", {
        projectIds: projects.map((project) => project.id),
      });
      const error = getActionError(result);
      if (error) {
        setImportErrorMessage(error);
        setImportStatusMessage(null);
        return;
      }

      const checkedProjectCount =
        typeof result?.result?.checkedProjectCount === "number"
          ? result.result.checkedProjectCount
          : 0;
      const originProjectCount =
        typeof result?.result?.originProjectCount === "number"
          ? result.result.originProjectCount
          : 0;

      setImportStatusMessage(
        checkedProjectCount > 0
          ? `Scanned ${checkedProjectCount} · Found ${originProjectCount} origins`
          : "Nothing to scan",
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
          Git commit model, skill creator model, project UI import, and favorite folders.
        </p>
      </div>

      <section className={cn(settingsSectionClass, "gap-2")}>
        <div className="relative">
          <button
            ref={gitCommitButtonRef}
            type="button"
            className={settingsSelectButtonClass}
            onClick={() => setGitCommitMenuOpen((current) => !current)}
            aria-haspopup="menu"
            aria-expanded={gitCommitMenuOpen}
            aria-controls={gitCommitMenuId}
          >
            <div className="grid min-w-0 grid-cols-[16px_minmax(0,1fr)] items-center gap-3">
              <GitCommitHorizontal size={16} className="text-[color:var(--muted)]" />
              <div className="min-w-0">
                <div className="truncate text-[13px] text-[color:var(--muted)]">
                  Git commit message model
                </div>
                <div className="truncate text-[14px] text-[color:var(--text)]">
                  {gitCommitCurrentValue}
                </div>
              </div>
            </div>
            <ChevronDown
              size={14}
              className={cn(
                "text-[color:var(--muted)] transition-transform",
                gitCommitMenuOpen && "rotate-180",
              )}
            />
          </button>

          {gitCommitMenuPresent ? (
            <ComposerMenu
              items={buildModelMenuItems(selectedGitCommitModel, currentModel, availableModels)}
              menuId={gitCommitMenuId}
              panelRef={gitCommitPanelRef}
              onSelect={handleSelectGitCommitModel}
              widthClassName="top-[calc(100%+8px)] bottom-auto left-0 w-full max-h-80 overflow-y-auto"
            />
          ) : null}
        </div>

        <div className="relative">
          <button
            ref={skillCreatorButtonRef}
            type="button"
            className={settingsSelectButtonClass}
            onClick={() => setSkillCreatorMenuOpen((current) => !current)}
            aria-haspopup="menu"
            aria-expanded={skillCreatorMenuOpen}
            aria-controls={skillCreatorMenuId}
          >
            <div className="grid min-w-0 grid-cols-[16px_minmax(0,1fr)] items-center gap-3">
              <FilePenLine size={16} className="text-[color:var(--muted)]" />
              <div className="min-w-0">
                <div className="truncate text-[13px] text-[color:var(--muted)]">
                  Skill creator model
                </div>
                <div className="truncate text-[14px] text-[color:var(--text)]">
                  {skillCreatorCurrentValue}
                </div>
              </div>
            </div>
            <ChevronDown
              size={14}
              className={cn(
                "text-[color:var(--muted)] transition-transform",
                skillCreatorMenuOpen && "rotate-180",
              )}
            />
          </button>

          {skillCreatorMenuPresent ? (
            <ComposerMenu
              items={buildModelMenuItems(selectedSkillCreatorModel, currentModel, availableModels)}
              menuId={skillCreatorMenuId}
              panelRef={skillCreatorPanelRef}
              onSelect={handleSelectSkillCreatorModel}
              widthClassName="top-[calc(100%+8px)] bottom-auto left-0 w-full max-h-80 overflow-y-auto"
            />
          ) : null}
        </div>
      </section>

      <section className={settingsSectionClass}>
        <div className="grid gap-1">
          <h2 className="m-0 text-[15px] font-medium text-[color:var(--text)]">New projects</h2>
          <p className="m-0 text-[13px] text-[color:var(--muted)]">
            Set where new projects are created and whether git should be initialised for diffs.
          </p>
        </div>

        <div className="grid gap-2">
          <div className="grid gap-1">
            <div className="grid grid-cols-[16px_minmax(0,1fr)] items-center gap-2 text-[13px] text-[color:var(--muted)]">
              <FolderPlus size={14} />
              <span>Default project location</span>
            </div>
            <input
              type="text"
              value={preferredProjectLocationDraft}
              onChange={(event) => setPreferredProjectLocationDraft(event.target.value)}
              onBlur={savePreferredProjectLocation}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  savePreferredProjectLocation();
                }
              }}
              className={settingsInputClass}
              placeholder="Paste an absolute folder path"
              aria-label="Default project location"
            />
          </div>

          <div className={settingsListRowClass}>
            <div className="grid gap-0.5">
              <div className="text-[13px] text-[color:var(--text)]">
                Initialise git for new projects
              </div>
              <div className="text-[12px] text-[color:var(--muted)]">
                Enables diffs for new projects.
              </div>
            </div>
            <button
              type="button"
              className={cn(
                "inline-flex h-5 w-5 items-center justify-center rounded-md border transition-colors",
                appSettings.initializeGitOnProjectCreate
                  ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-[#1a1c26]"
                  : "border-[color:var(--border)] bg-transparent text-transparent hover:border-[color:var(--border-strong)]",
              )}
              onClick={() => {
                void onAction("settings.update", {
                  key: "initializeGitOnProjectCreate",
                  value: !appSettings.initializeGitOnProjectCreate,
                });
              }}
              aria-label="Initialise git for new projects"
              aria-pressed={appSettings.initializeGitOnProjectCreate}
            >
              <Check size={13} />
            </button>
          </div>
        </div>
      </section>

      <section className={settingsSectionClass}>
        <div className="grid gap-1">
          <h2 className="m-0 text-[15px] font-medium text-[color:var(--text)]">
            Project UI import
          </h2>
          <p className="m-0 text-[13px] text-[color:var(--muted)]">
            This scans your current projects for UI information like repo/origin status. New
            projects are still checked once when you open them for the first time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className={cn(
              primaryButtonClass,
              "px-3 disabled:cursor-not-allowed disabled:opacity-45",
            )}
            onClick={() => {
              void handleImportProjectUi();
            }}
            disabled={importBusy}
          >
            {importBusy
              ? "Importing…"
              : appSettings.projectImportState
                ? "Run again"
                : "Import now"}
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
              Show first-launch reminder again
            </button>
          ) : null}
        </div>

        {importStatusMessage ? (
          <div className="text-[12px] text-[color:var(--muted)]">{importStatusMessage}</div>
        ) : null}
        {importErrorMessage ? (
          <div className="text-[12px] text-[#f2a7a7]">{importErrorMessage}</div>
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
