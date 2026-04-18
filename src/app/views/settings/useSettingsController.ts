import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AppSettings,
  DesktopActionInvoker,
  DesktopEvent,
  DictationModelId,
  DictationModelSummary,
  DictationState,
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

function normalizeManagedDictationModelId(
  modelId: string | null | undefined,
): DictationModelId | null {
  return modelId === "tiny.en" || modelId === "base.en" || modelId === "small.en" ? modelId : null;
}

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
  const [dictationState, setDictationState] = useState<DictationState | null>(null);
  const [dictationModels, setDictationModels] = useState<DictationModelSummary[]>([]);
  const [dictationPendingAction, setDictationPendingAction] = useState<{
    modelId: DictationModelId;
    kind: "download" | "switch" | "delete";
  } | null>(null);
  const [dictationInstallError, setDictationInstallError] = useState<string | null>(null);
  const [dictationDownloadLogLines, setDictationDownloadLogLines] = useState<string[]>([]);
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

  useEffect(() => {
    if (!appSettings.dictationModelId) {
      return;
    }

    setDictationModels((current) =>
      current.map((model) => ({
        ...model,
        selected: model.installed && model.id === appSettings.dictationModelId,
      })),
    );
  }, [appSettings.dictationModelId]);

  const refreshDictationState = useCallback(async () => {
    const [nextDictationState, nextDictationModels] = await Promise.all([
      window.piDesktop?.getDictationState?.().catch(() => null) ?? Promise.resolve(null),
      window.piDesktop?.listDictationModels?.().catch(() => []) ?? Promise.resolve([]),
    ]);

    setDictationState(nextDictationState);
    setDictationModels(nextDictationModels);
  }, []);

  useEffect(() => {
    void refreshDictationState();
  }, [refreshDictationState]);

  useEffect(() => {
    if (!window.piDesktop?.subscribe) {
      return;
    }

    return window.piDesktop.subscribe((event: DesktopEvent) => {
      if (event.type !== "dictation-download-log") {
        return;
      }

      setDictationDownloadLogLines((current) => {
        const nextLines = [...current, `bun ${event.modelId}: ${event.message}`];
        return nextLines.slice(-12);
      });
    });
  }, []);

  const appendDictationDownloadLogLine = useCallback((line: string) => {
    setDictationDownloadLogLines((current) => [...current, line].slice(-12));
  }, []);

  const getActiveDictationModelId = useCallback(() => {
    return (
      dictationModels.find((model) => model.selected)?.id ??
      normalizeManagedDictationModelId(dictationState?.modelId) ??
      normalizeManagedDictationModelId(appSettings.dictationModelId) ??
      null
    );
  }, [appSettings.dictationModelId, dictationModels, dictationState?.modelId]);

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

  const installDictationModel = async (modelId: DictationModelId) => {
    if (!window.piDesktop?.installDictationModel) {
      setDictationInstallError("Dictation model installs are unavailable in this runtime.");
      return;
    }

    setDictationPendingAction({ modelId, kind: "download" });
    setDictationInstallError(null);
    setDictationDownloadLogLines([]);
    appendDictationDownloadLogLine(`ui ${modelId}: install requested`);

    try {
      appendDictationDownloadLogLine(`ui ${modelId}: calling desktop RPC…`);
      const result = await window.piDesktop.installDictationModel(modelId);
      appendDictationDownloadLogLine(
        `ui ${modelId}: RPC resolved (ok=${result.ok ? "yes" : "no"})`,
      );

      if (!result.ok) {
        setDictationInstallError(result.error ?? "Could not download dictation model.");
        return;
      }

      setDictationPendingAction({ modelId, kind: "switch" });
      await onAction("settings.update", {
        key: "dictationModelId",
        value: modelId,
      });

      setDictationModels((current) =>
        current.map((model) => ({
          ...model,
          installed: model.id === modelId || model.installed,
          selected: model.id === modelId,
        })),
      );

      await refreshDictationState();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not download dictation model.";
      appendDictationDownloadLogLine(`ui ${modelId}: RPC threw ${message}`);
      setDictationInstallError(message);
    } finally {
      setDictationPendingAction(null);
    }
  };

  const selectDictationModel = async (modelId: DictationModelId) => {
    setDictationPendingAction({ modelId, kind: "switch" });
    setDictationInstallError(null);
    setDictationModels((current) =>
      current.map((model) => ({
        ...model,
        selected: model.id === modelId,
      })),
    );

    try {
      await onAction("settings.update", {
        key: "dictationModelId",
        value: modelId,
      });

      await refreshDictationState();
    } catch (error) {
      setDictationInstallError(
        error instanceof Error ? error.message : "Could not switch dictation model.",
      );
    } finally {
      setDictationPendingAction(null);
    }
  };

  const deleteDictationModel = async (modelId: DictationModelId) => {
    if (!window.piDesktop?.removeDictationModel) {
      setDictationInstallError("Dictation model removal is unavailable in this runtime.");
      return;
    }

    const activeModelId = getActiveDictationModelId();

    setDictationPendingAction({ modelId, kind: "delete" });
    setDictationInstallError(null);
    appendDictationDownloadLogLine(`ui ${modelId}: delete requested`);

    try {
      const result = await window.piDesktop.removeDictationModel(modelId);
      appendDictationDownloadLogLine(
        `ui ${modelId}: delete resolved (ok=${result.ok ? "yes" : "no"})`,
      );

      if (!result.ok) {
        setDictationInstallError(result.error ?? "Could not remove dictation model.");
        return;
      }

      if (activeModelId === modelId) {
        await onAction("settings.update", {
          key: "dictationModelId",
          value: null,
        });
      }

      await refreshDictationState();
    } catch (error) {
      setDictationInstallError(
        error instanceof Error ? error.message : "Could not remove dictation model.",
      );
    } finally {
      setDictationPendingAction(null);
    }
  };

  return {
    addFavoriteFolder,
    deleteDictationModel,
    dictationDownloadLogLines,
    dictationInstallError,
    dictationModels,
    dictationPendingAction,
    dictationState,
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
    installDictationModel,
    preferredProjectLocationDraft,
    refreshDictationState,
    savePreferredProjectLocation,
    setComposerStreamingBehavior: (value: AppSettings["composerStreamingBehavior"]) =>
      void onAction("settings.update", {
        key: "composerStreamingBehavior",
        value,
      }),
    setShowDictationButton: (value: boolean) =>
      void onAction("settings.update", {
        key: "showDictationButton",
        value,
      }),
    selectDictationModel,
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
    setProjectDeletionMode: (value: AppSettings["projectDeletionMode"]) =>
      void onAction("settings.update", {
        key: "projectDeletionMode",
        value,
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
