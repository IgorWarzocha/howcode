import { useCallback, useEffect, useState } from "react";
import type {
  AppSettings,
  DesktopActionInvoker,
  DesktopEvent,
  DictationModelId,
  DictationModelSummary,
  DictationState,
} from "../../desktop/types";

export type DictationPendingAction = {
  modelId: DictationModelId;
  kind: "download" | "switch" | "delete";
};

function normalizeManagedDictationModelId(
  modelId: string | null | undefined,
): DictationModelId | null {
  return modelId === "tiny.en" || modelId === "base.en" || modelId === "small.en" ? modelId : null;
}

export function useSettingsDictationController({
  appSettings,
  onAction,
}: {
  appSettings: AppSettings;
  onAction: DesktopActionInvoker;
}) {
  const [dictationState, setDictationState] = useState<DictationState | null>(null);
  const [dictationModels, setDictationModels] = useState<DictationModelSummary[]>([]);
  const [dictationPendingAction, setDictationPendingAction] =
    useState<DictationPendingAction | null>(null);
  const [dictationInstallError, setDictationInstallError] = useState<string | null>(null);
  const [dictationDownloadLogLines, setDictationDownloadLogLines] = useState<string[]>([]);

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

    return {
      dictationState: nextDictationState,
      dictationModels: nextDictationModels,
    };
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

      if (event.done) {
        void refreshDictationState();
      }
    });
  }, [refreshDictationState]);

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
        await refreshDictationState();
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
      await refreshDictationState();
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
      await refreshDictationState();
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
        await refreshDictationState();
        return;
      }

      if (activeModelId === modelId) {
        const refreshedState = await refreshDictationState();
        const modelStillInstalled = refreshedState.dictationModels.some(
          (model) => model.id === modelId && model.installed,
        );

        if (!modelStillInstalled) {
          await onAction("settings.update", {
            key: "dictationModelId",
            value: null,
          });
        }
      }

      await refreshDictationState();
    } catch (error) {
      setDictationInstallError(
        error instanceof Error ? error.message : "Could not remove dictation model.",
      );
      await refreshDictationState();
    } finally {
      setDictationPendingAction(null);
    }
  };

  return {
    deleteDictationModel,
    dictationDownloadLogLines,
    dictationInstallError,
    dictationModels,
    dictationPendingAction,
    dictationState,
    installDictationModel,
    refreshDictationState,
    selectDictationModel,
  };
}
