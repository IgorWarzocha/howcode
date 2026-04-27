import type { QueryClient } from "@tanstack/react-query";
import type { DesktopAction } from "../desktop/actions";
import type { ComposerThinkingLevel, PiSettings, ShellState } from "../desktop/types";
import { desktopQueryKeys } from "../query/desktop-query";
import {
  type ActionPayload,
  getPayloadProjectId,
  getPayloadThreadId,
  sortPinnedProjects,
  sortPinnedThreads,
} from "./controller-action-utils";

export function getOptimisticallyUpdatedShellState(
  currentState: ShellState | null,
  payload: ActionPayload,
) {
  if (!currentState) {
    return null;
  }

  if (
    payload.key !== "gitCommitMessageModel" &&
    payload.key !== "gitCommitMessageThinkingLevel" &&
    payload.key !== "skillCreatorModel" &&
    payload.key !== "skillCreatorThinkingLevel" &&
    payload.key !== "composerStreamingBehavior" &&
    payload.key !== "dictationModelId" &&
    payload.key !== "dictationMaxDurationSeconds" &&
    payload.key !== "showDictationButton" &&
    payload.key !== "favoriteFolders" &&
    payload.key !== "projectImportState" &&
    payload.key !== "preferredProjectLocation" &&
    payload.key !== "initializeGitOnProjectCreate" &&
    payload.key !== "projectDeletionMode" &&
    payload.key !== "useAgentsSkillsPaths" &&
    payload.key !== "piTuiTakeover"
  ) {
    return currentState;
  }

  const nextSelection =
    payload.key === "gitCommitMessageModel"
      ? payload.reset === true
        ? null
        : typeof payload.provider === "string" && typeof payload.modelId === "string"
          ? { provider: payload.provider, id: payload.modelId }
          : currentState.appSettings.gitCommitMessageModel
      : currentState.appSettings.gitCommitMessageModel;

  const nextSkillCreatorSelection =
    payload.key === "skillCreatorModel"
      ? payload.reset === true
        ? null
        : typeof payload.provider === "string" && typeof payload.modelId === "string"
          ? { provider: payload.provider, id: payload.modelId }
          : currentState.appSettings.skillCreatorModel
      : currentState.appSettings.skillCreatorModel;

  const isThinkingLevel = (value: unknown): value is ComposerThinkingLevel =>
    value === "off" ||
    value === "minimal" ||
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "xhigh";

  const nextGitCommitThinkingLevel =
    payload.key === "gitCommitMessageThinkingLevel" && isThinkingLevel(payload.value)
      ? payload.value
      : currentState.appSettings.gitCommitMessageThinkingLevel;

  const nextSkillCreatorThinkingLevel =
    payload.key === "skillCreatorThinkingLevel" && isThinkingLevel(payload.value)
      ? payload.value
      : currentState.appSettings.skillCreatorThinkingLevel;

  const nextComposerStreamingBehavior =
    payload.key === "composerStreamingBehavior" &&
    (payload.value === "steer" || payload.value === "followUp" || payload.value === "stop")
      ? payload.value
      : currentState.appSettings.composerStreamingBehavior;

  const nextDictationModelId =
    payload.key === "dictationModelId" &&
    (payload.value === null ||
      payload.value === "tiny.en" ||
      payload.value === "base.en" ||
      payload.value === "small.en")
      ? payload.value
      : currentState.appSettings.dictationModelId;

  const nextDictationMaxDurationSeconds =
    payload.key === "dictationMaxDurationSeconds" && typeof payload.value === "number"
      ? payload.value
      : currentState.appSettings.dictationMaxDurationSeconds;

  const nextShowDictationButton =
    payload.key === "showDictationButton" && typeof payload.value === "boolean"
      ? payload.value
      : currentState.appSettings.showDictationButton;

  const nextFavoriteFolders =
    payload.key === "favoriteFolders" && Array.isArray(payload.folders)
      ? [
          ...new Set(
            payload.folders
              .filter((folder): folder is string => typeof folder === "string")
              .map((folder) => folder.trim())
              .filter(Boolean),
          ),
        ]
      : currentState.appSettings.favoriteFolders;

  const nextProjectImportState =
    payload.key === "projectImportState" &&
    (payload.imported === null || typeof payload.imported === "boolean")
      ? payload.imported
      : currentState.appSettings.projectImportState;

  const nextPreferredProjectLocation =
    payload.key === "preferredProjectLocation"
      ? typeof payload.value === "string"
        ? payload.value.trim() || null
        : null
      : currentState.appSettings.preferredProjectLocation;

  const nextInitializeGitOnProjectCreate =
    payload.key === "initializeGitOnProjectCreate" && typeof payload.value === "boolean"
      ? payload.value
      : currentState.appSettings.initializeGitOnProjectCreate;

  const nextProjectDeletionMode =
    payload.key === "projectDeletionMode" &&
    (payload.value === "pi-only" || payload.value === "full-clean")
      ? payload.value
      : currentState.appSettings.projectDeletionMode;

  const nextUseAgentsSkillsPaths =
    payload.key === "useAgentsSkillsPaths" && typeof payload.value === "boolean"
      ? payload.value
      : currentState.appSettings.useAgentsSkillsPaths;

  const nextPiTuiTakeover =
    payload.key === "piTuiTakeover" && typeof payload.value === "boolean"
      ? payload.value
      : currentState.appSettings.piTuiTakeover;

  return {
    ...currentState,
    appSettings: {
      ...currentState.appSettings,
      gitCommitMessageModel: nextSelection,
      gitCommitMessageThinkingLevel: nextGitCommitThinkingLevel,
      skillCreatorModel: nextSkillCreatorSelection,
      skillCreatorThinkingLevel: nextSkillCreatorThinkingLevel,
      composerStreamingBehavior: nextComposerStreamingBehavior,
      dictationModelId: nextDictationModelId,
      dictationMaxDurationSeconds: nextDictationMaxDurationSeconds,
      showDictationButton: nextShowDictationButton,
      favoriteFolders: nextFavoriteFolders,
      projectImportState: nextProjectImportState,
      preferredProjectLocation: nextPreferredProjectLocation,
      initializeGitOnProjectCreate: nextInitializeGitOnProjectCreate,
      projectDeletionMode: nextProjectDeletionMode,
      useAgentsSkillsPaths: nextUseAgentsSkillsPaths,
      piTuiTakeover: nextPiTuiTakeover,
    },
  } satisfies ShellState;
}

export function applyOptimisticSettingsUpdate(queryClient: QueryClient, payload: ActionPayload) {
  queryClient.setQueryData<ShellState | null>(desktopQueryKeys.shellState(), (currentState) =>
    getOptimisticallyUpdatedShellState(currentState ?? null, payload),
  );
}

function isPiSettingsKey(value: unknown): value is keyof PiSettings {
  return (
    typeof value === "string" &&
    [
      "autoCompact",
      "enableSkillCommands",
      "hideThinkingBlock",
      "quietStartup",
      "showImages",
      "autoResizeImages",
      "blockImages",
      "collapseChangelog",
      "enableInstallTelemetry",
      "showHardwareCursor",
      "clearOnShrink",
      "transport",
      "steeringMode",
      "followUpMode",
      "doubleEscapeAction",
      "treeFilterMode",
      "editorPaddingX",
      "autocompleteMaxVisible",
      "imageWidthCells",
    ].includes(value)
  );
}

function getOptimisticPiSettingsValue<Key extends keyof PiSettings>(
  key: Key,
  value: unknown,
  currentValue: PiSettings[Key],
): PiSettings[Key] | null {
  if (typeof value !== typeof currentValue) {
    return null;
  }

  if (key === "editorPaddingX" || key === "autocompleteMaxVisible" || key === "imageWidthCells") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return null;
    }

    const [min, max] =
      key === "editorPaddingX" ? [0, 3] : key === "autocompleteMaxVisible" ? [3, 20] : [1, 200];
    return Math.max(min, Math.min(max, Math.floor(value))) as PiSettings[Key];
  }

  if (key === "transport" && value !== "sse" && value !== "websocket" && value !== "auto") {
    return null;
  }

  if (
    (key === "steeringMode" || key === "followUpMode") &&
    value !== "all" &&
    value !== "one-at-a-time"
  ) {
    return null;
  }

  if (key === "doubleEscapeAction" && value !== "fork" && value !== "tree" && value !== "none") {
    return null;
  }

  if (
    key === "treeFilterMode" &&
    value !== "default" &&
    value !== "no-tools" &&
    value !== "user-only" &&
    value !== "labeled-only" &&
    value !== "all"
  ) {
    return null;
  }

  return value as PiSettings[Key];
}

export function getOptimisticallyUpdatedPiSettingsState(
  currentState: ShellState | null,
  payload: ActionPayload,
) {
  if (!currentState || !isPiSettingsKey(payload.piSettingsKey)) {
    return currentState;
  }

  const currentValue = currentState.piSettings[payload.piSettingsKey];
  const nextValue = getOptimisticPiSettingsValue(
    payload.piSettingsKey,
    payload.value,
    currentValue,
  );
  if (nextValue === null) {
    return currentState;
  }

  return {
    ...currentState,
    piSettings: {
      ...currentState.piSettings,
      [payload.piSettingsKey]: nextValue,
    },
  } satisfies ShellState;
}

export function applyOptimisticPiSettingsUpdate(queryClient: QueryClient, payload: ActionPayload) {
  queryClient.setQueryData<ShellState | null>(desktopQueryKeys.shellState(), (currentState) =>
    getOptimisticallyUpdatedPiSettingsState(currentState ?? null, payload),
  );
}

export function getOptimisticallyRenamedShellState(
  currentState: ShellState | null,
  payload: ActionPayload,
) {
  if (!currentState) {
    return null;
  }

  const projectId = getPayloadProjectId(payload);
  const projectName = typeof payload.projectName === "string" ? payload.projectName.trim() : "";

  if (!projectId || projectName.length === 0) {
    return currentState;
  }

  return {
    ...currentState,
    projects: currentState.projects.map((project) =>
      project.id === projectId ? { ...project, name: projectName } : project,
    ),
  } satisfies ShellState;
}

export function applyOptimisticProjectRename(queryClient: QueryClient, payload: ActionPayload) {
  queryClient.setQueryData<ShellState | null>(desktopQueryKeys.shellState(), (currentState) =>
    getOptimisticallyRenamedShellState(currentState ?? null, payload),
  );
}

export function getOptimisticallyPinnedShellState(
  currentState: ShellState | null,
  action: DesktopAction,
  payload: ActionPayload,
) {
  if (!currentState) {
    return null;
  }

  if (action === "thread.pin") {
    const projectId = getPayloadProjectId(payload);
    const threadId = getPayloadThreadId(payload);

    if (!projectId || !threadId) {
      return currentState;
    }

    return {
      ...currentState,
      projects: currentState.projects.map((project) => {
        if (project.id !== projectId) {
          return project;
        }

        const nextThreads = sortPinnedThreads(
          project.threads.map((thread) =>
            thread.id === threadId ? { ...thread, pinned: !thread.pinned } : thread,
          ),
        );

        return {
          ...project,
          threads: nextThreads,
        };
      }),
    } satisfies ShellState;
  }

  if (action === "project.pin") {
    const projectId = getPayloadProjectId(payload);

    if (!projectId) {
      return currentState;
    }

    return {
      ...currentState,
      projects: sortPinnedProjects(
        currentState.projects.map((project) =>
          project.id === projectId ? { ...project, pinned: !project.pinned } : project,
        ),
      ),
    } satisfies ShellState;
  }

  return currentState;
}

export function applyOptimisticPinUpdate(
  queryClient: QueryClient,
  action: DesktopAction,
  payload: ActionPayload,
) {
  queryClient.setQueryData<ShellState | null>(desktopQueryKeys.shellState(), (currentState) =>
    getOptimisticallyPinnedShellState(currentState ?? null, action, payload),
  );
}
