import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AppSettings,
  ComposerModel,
  DesktopActionInvoker,
  ModelSelection,
} from "../../desktop/types";
import { useAnimatedPresence } from "../../hooks/useAnimatedPresence";
import { useDismissibleLayer } from "../../hooks/useDismissibleLayer";
import type { Project } from "../../types";
import {
  buildModelSelectionPayload,
  getActionError,
  getModelSettingValue,
  getProjectImportSummaryMessage,
} from "./helpers";

export function useSettingsController({
  appSettings,
  projects,
  onAction,
}: {
  appSettings: AppSettings;
  projects: Project[];
  onAction: DesktopActionInvoker;
}) {
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
  const skillCreatorButtonRef = useRef<HTMLButtonElement>(null);
  const skillCreatorPanelRef = useRef<HTMLDivElement>(null);
  const skillCreatorMenuPresent = useAnimatedPresence(skillCreatorMenuOpen);

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

    updateFavoriteFolders([...appSettings.favoriteFolders, nextFavoriteFolder]);
    setFavoriteFolderDraft("");
  };

  const savePreferredProjectLocation = () => {
    void onAction("settings.update", {
      key: "preferredProjectLocation",
      value: preferredProjectLocationDraft,
    });
  };

  const selectModel = (
    key: "gitCommitMessageModel" | "skillCreatorModel",
    id: string,
    closeMenu: () => void,
  ) => {
    void onAction("settings.update", buildModelSelectionPayload(key, id));
    closeMenu();
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

      setImportStatusMessage(getProjectImportSummaryMessage(result));
    } finally {
      setImportBusy(false);
    }
  };

  return {
    addFavoriteFolder,
    favoriteFolderDraft,
    gitCommitButtonRef,
    gitCommitCurrentValue: getModelSettingValue(appSettings.gitCommitMessageModel),
    gitCommitMenuId: "settings-git-commit-model-menu",
    gitCommitMenuOpen,
    gitCommitMenuPresent,
    gitCommitPanelRef,
    importBusy,
    importErrorMessage,
    importStatusMessage,
    preferredProjectLocationDraft,
    savePreferredProjectLocation,
    selectGitCommitModel: (id: string) =>
      selectModel("gitCommitMessageModel", id, closeGitCommitMenu),
    selectSkillCreatorModel: (id: string) =>
      selectModel("skillCreatorModel", id, closeSkillCreatorMenu),
    setFavoriteFolderDraft,
    setGitCommitMenuOpen,
    setPreferredProjectLocationDraft,
    setSkillCreatorMenuOpen,
    skillCreatorButtonRef,
    skillCreatorCurrentValue: getModelSettingValue(appSettings.skillCreatorModel),
    skillCreatorMenuId: "settings-skill-creator-model-menu",
    skillCreatorMenuOpen,
    skillCreatorMenuPresent,
    skillCreatorPanelRef,
    toggleInitializeGitOnProjectCreate: () =>
      void onAction("settings.update", {
        key: "initializeGitOnProjectCreate",
        value: !appSettings.initializeGitOnProjectCreate,
      }),
    togglePiTuiTakeover: () =>
      void onAction("settings.update", {
        key: "piTuiTakeover",
        value: !appSettings.piTuiTakeover,
      }),
    updateFavoriteFolders,
    handleImportProjectUi,
    showFirstLaunchReminderAgain: () =>
      void onAction("settings.update", {
        key: "projectImportState",
        imported: null,
      }),
  };
}
