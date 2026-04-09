import { ViewHeader } from "../components/common/ViewHeader";
import { ViewShell } from "../components/common/ViewShell";
import type { AppSettings, ComposerModel, DesktopActionInvoker } from "../desktop/types";
import type { Project } from "../types";
import { SettingsFavoriteFoldersSection } from "./settings/SettingsFavoriteFoldersSection";
import { SettingsModelSection } from "./settings/SettingsModelSection";
import { SettingsProjectDefaultsSection } from "./settings/SettingsProjectDefaultsSection";
import { SettingsProjectImportSection } from "./settings/SettingsProjectImportSection";
import { useSettingsController } from "./settings/useSettingsController";

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
  const controller = useSettingsController({ appSettings, projects, onAction });

  return (
    <ViewShell maxWidthClassName="max-w-[760px]">
      <ViewHeader
        title="Settings"
        subtitle="Git commit model, skill creator model, project UI import, and favorite folders."
      />

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

      <SettingsProjectDefaultsSection
        appSettings={appSettings}
        preferredProjectLocationDraft={controller.preferredProjectLocationDraft}
        savePreferredProjectLocation={controller.savePreferredProjectLocation}
        setPreferredProjectLocationDraft={controller.setPreferredProjectLocationDraft}
        toggleInitializeGitOnProjectCreate={controller.toggleInitializeGitOnProjectCreate}
      />

      <SettingsProjectImportSection
        importBusy={controller.importBusy}
        importErrorMessage={controller.importErrorMessage}
        importStatusMessage={controller.importStatusMessage}
        importedState={appSettings.projectImportState}
        onImport={() => {
          void controller.handleImportProjectUi();
        }}
        onShowFirstLaunchReminderAgain={controller.showFirstLaunchReminderAgain}
      />

      <SettingsFavoriteFoldersSection
        favoriteFolderDraft={controller.favoriteFolderDraft}
        favoriteFolders={appSettings.favoriteFolders}
        addFavoriteFolder={controller.addFavoriteFolder}
        setFavoriteFolderDraft={controller.setFavoriteFolderDraft}
        updateFavoriteFolders={controller.updateFavoriteFolders}
      />
    </ViewShell>
  );
}
