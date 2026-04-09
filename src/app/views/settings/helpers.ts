import type {
  ComposerModel,
  DesktopActionResult,
  DesktopSettingsUpdatePayload,
  ModelSelection,
} from "../../desktop/types";

export function getActionError(result: DesktopActionResult | null) {
  return typeof result?.result?.error === "string" ? result.result.error : null;
}

export function getModelSettingValue(selection: ModelSelection | null) {
  return selection ? `${selection.provider}/${selection.id}` : "Use composer model";
}

export function buildModelMenuItems(
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

export function buildModelSelectionPayload(
  key: "gitCommitMessageModel" | "skillCreatorModel",
  id: string,
): DesktopSettingsUpdatePayload {
  if (id === "composer-default") {
    return { key, reset: true };
  }

  const [provider, ...modelIdParts] = id.split("/");
  const modelId = modelIdParts.join("/");

  if (key === "gitCommitMessageModel") {
    return {
      key,
      provider,
      modelId,
    };
  }

  return {
    key,
    provider,
    modelId,
  };
}

export function getProjectImportSummaryMessage(result: DesktopActionResult | null) {
  const checkedProjectCount =
    typeof result?.result?.checkedProjectCount === "number" ? result.result.checkedProjectCount : 0;
  const originProjectCount =
    typeof result?.result?.originProjectCount === "number" ? result.result.originProjectCount : 0;

  return checkedProjectCount > 0
    ? `Scanned ${checkedProjectCount} · Found ${originProjectCount} origins`
    : "Nothing to scan";
}
