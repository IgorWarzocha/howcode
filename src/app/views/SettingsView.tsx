import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { ViewHeader } from "../components/common/ViewHeader";
import { ViewShell } from "../components/common/ViewShell";
import type {
  AppSettings,
  ComposerModel,
  DesktopActionInvoker,
  PiSettings,
} from "../desktop/types";
import { settingsInputClass } from "../ui/classes";
import { cn } from "../utils/cn";
import type { Project } from "../types";
import { SettingsFavoriteFoldersSection } from "./settings/SettingsFavoriteFoldersSection";
import { SettingsDictationSection } from "./settings/SettingsDictationSection";
import { SettingsModelSection } from "./settings/SettingsModelSection";
import { SettingsPiSection } from "./settings/SettingsPiSection";
import { SettingsProjectDefaultsSection } from "./settings/SettingsProjectDefaultsSection";
import { SettingsProjectImportSection } from "./settings/SettingsProjectImportSection";
import { useSettingsController } from "./settings/useSettingsController";

type SettingsViewProps = {
  appSettings: AppSettings;
  piSettings: PiSettings;
  availableModels: ComposerModel[];
  currentModel: ComposerModel | null;
  projects: Project[];
  onAction: DesktopActionInvoker;
  onClose: () => void;
};

type SettingsSectionId = "defaults" | "pi" | "models" | "dictation" | "import" | "favorites";

const settingsSectionMeta: Record<SettingsSectionId, { label: string; keywords: string }> = {
  defaults: {
    label: "Defaults",
    keywords:
      "defaults project location streaming send queue steer stop deletion cleanup git tui takeover conversations",
  },
  pi: {
    label: "Pi",
    keywords:
      "pi runtime tui compact skills slash commands transport steering follow-up images telemetry cursor autocomplete thinking",
  },
  models: {
    label: "Models",
    keywords: "models git commit message skill creator provider openai codex",
  },
  dictation: {
    label: "Dictation",
    keywords: "dictation speech voice transcription model whisper duration microphone",
  },
  import: {
    label: "Import",
    keywords: "import project ui first launch migration existing projects",
  },
  favorites: {
    label: "Favorites",
    keywords: "favorite folders attachments picker paths home directories",
  },
};

export function SettingsView({
  appSettings,
  piSettings,
  availableModels,
  currentModel,
  projects,
  onAction,
  onClose,
}: SettingsViewProps) {
  const controller = useSettingsController({ appSettings, projects, onAction });
  const [filter, setFilter] = useState("");
  const normalizedFilter = filter.trim().toLowerCase();
  const visibleSections = useMemo(() => {
    const matches = (id: SettingsSectionId) => {
      if (!normalizedFilter) {
        return true;
      }

      const section = settingsSectionMeta[id];
      return `${section.label} ${section.keywords}`.toLowerCase().includes(normalizedFilter);
    };

    return {
      defaults: matches("defaults"),
      pi: matches("pi"),
      models: matches("models"),
      dictation: matches("dictation"),
      import: matches("import"),
      favorites: matches("favorites"),
    } satisfies Record<SettingsSectionId, boolean>;
  }, [normalizedFilter]);
  const visibleSectionCount = Object.values(visibleSections).filter(Boolean).length;
  const matchingLabels = (Object.entries(visibleSections) as [SettingsSectionId, boolean][])
    .filter(([, visible]) => visible)
    .map(([id]) => settingsSectionMeta[id].label);

  return (
    <ViewShell maxWidthClassName="max-w-[1040px]">
      <ViewHeader
        title="App settings"
        subtitle="Search, tune desktop behavior, and manage shared Pi runtime settings from one place."
        onClose={onClose}
        closeLabel="Close app settings"
      />

      <div className="sticky top-0 z-20 -mx-1 rounded-[22px] border border-[rgba(169,178,215,0.12)] bg-[color-mix(in_srgb,var(--workspace)_88%,transparent)] p-2 shadow-[0_18px_56px_rgba(0,0,0,0.22)] backdrop-blur-xl">
        <div className="grid gap-2 rounded-[16px] bg-[rgba(255,255,255,0.025)] p-2">
          <label className="relative block">
            <Search
              size={15}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[color:var(--muted)]"
            />
            <input
              type="search"
              value={filter}
              onChange={(event) => setFilter(event.currentTarget.value)}
              className={cn(settingsInputClass, "h-10 w-full pl-9")}
              placeholder="Filter settings… try “skills”, “queue”, “dictation”, “images”"
              aria-label="Filter settings"
            />
          </label>
          <div className="flex min-h-6 flex-wrap items-center gap-1.5 px-1 text-[11px] text-[color:var(--muted)]">
            {visibleSectionCount > 0 ? (
              <>
                <span className="mr-1 text-[color:var(--muted-2)]">
                  {normalizedFilter ? "Matches" : "Sections"}
                </span>
                {matchingLabels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full border border-[rgba(169,178,215,0.12)] bg-[rgba(169,178,215,0.07)] px-2 py-0.5 text-[color:var(--muted)]"
                  >
                    {label}
                  </span>
                ))}
              </>
            ) : (
              <span>No settings match “{filter.trim()}”.</span>
            )}
          </div>
        </div>
      </div>

      {visibleSectionCount > 0 ? (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
          <div className="grid gap-4">
            {visibleSections.defaults ? (
              <SettingsProjectDefaultsSection
                appSettings={appSettings}
                preferredProjectLocationDraft={controller.preferredProjectLocationDraft}
                savePreferredProjectLocation={controller.savePreferredProjectLocation}
                setComposerStreamingBehavior={controller.setComposerStreamingBehavior}
                setPreferredProjectLocationDraft={controller.setPreferredProjectLocationDraft}
                setProjectDeletionMode={controller.setProjectDeletionMode}
                toggleInitializeGitOnProjectCreate={controller.toggleInitializeGitOnProjectCreate}
                togglePiTuiTakeover={controller.togglePiTuiTakeover}
              />
            ) : null}

            {visibleSections.pi ? (
              <SettingsPiSection piSettings={piSettings} onUpdate={controller.updatePiSetting} />
            ) : null}
          </div>

          <div className="grid gap-4">
            {visibleSections.models ? (
              <SettingsModelSection
                availableModels={availableModels}
                currentModel={currentModel}
                gitCommitButtonRef={controller.gitCommitButtonRef}
                gitCommitCurrentValue={controller.gitCommitCurrentValue}
                gitCommitMenuId={controller.gitCommitMenuId}
                gitCommitMenuOpen={controller.gitCommitMenuOpen}
                gitCommitMenuPresent={controller.gitCommitMenuPresent}
                gitCommitPanelRef={controller.gitCommitPanelRef}
                selectedGitCommitModel={appSettings.gitCommitMessageModel}
                selectedSkillCreatorModel={appSettings.skillCreatorModel}
                selectGitCommitModel={controller.selectGitCommitModel}
                selectSkillCreatorModel={controller.selectSkillCreatorModel}
                setGitCommitMenuOpen={controller.setGitCommitMenuOpen}
                setSkillCreatorMenuOpen={controller.setSkillCreatorMenuOpen}
                skillCreatorButtonRef={controller.skillCreatorButtonRef}
                skillCreatorCurrentValue={controller.skillCreatorCurrentValue}
                skillCreatorMenuId={controller.skillCreatorMenuId}
                skillCreatorMenuOpen={controller.skillCreatorMenuOpen}
                skillCreatorMenuPresent={controller.skillCreatorMenuPresent}
                skillCreatorPanelRef={controller.skillCreatorPanelRef}
              />
            ) : null}

            {visibleSections.dictation ? (
              <SettingsDictationSection
                appSettings={appSettings}
                deleteDictationModel={controller.deleteDictationModel}
                dictationDownloadLogLines={controller.dictationDownloadLogLines}
                dictationInstallError={controller.dictationInstallError}
                dictationPendingAction={controller.dictationPendingAction}
                dictationModels={controller.dictationModels}
                dictationState={controller.dictationState}
                installDictationModel={controller.installDictationModel}
                setDictationMaxDurationSeconds={controller.setDictationMaxDurationSeconds}
                selectDictationModel={controller.selectDictationModel}
                setShowDictationButton={controller.setShowDictationButton}
              />
            ) : null}

            {visibleSections.import ? (
              <SettingsProjectImportSection
                importBusy={controller.importBusy}
                desktopBridgeAvailable={controller.desktopBridgeAvailable}
                importErrorMessage={controller.importErrorMessage}
                importStatusMessage={controller.importStatusMessage}
                importedState={appSettings.projectImportState}
                onImport={() => {
                  void controller.handleImportProjectUi();
                }}
                onShowFirstLaunchReminderAgain={controller.showFirstLaunchReminderAgain}
              />
            ) : null}

            {visibleSections.favorites ? (
              <SettingsFavoriteFoldersSection
                favoriteFolderDraft={controller.favoriteFolderDraft}
                favoriteFolders={appSettings.favoriteFolders}
                addFavoriteFolder={controller.addFavoriteFolder}
                setFavoriteFolderDraft={controller.setFavoriteFolderDraft}
                updateFavoriteFolders={controller.updateFavoriteFolders}
              />
            ) : null}
          </div>
        </div>
      ) : (
        <div className="rounded-[22px] border border-[rgba(169,178,215,0.12)] bg-[rgba(255,255,255,0.025)] p-8 text-center">
          <div className="text-[14px] text-[color:var(--text)]">No matching settings</div>
          <div className="mt-1 text-[12px] text-[color:var(--muted)]">
            Try a broader term like “Pi”, “model”, “folder”, or “voice”.
          </div>
        </div>
      )}
    </ViewShell>
  );
}
