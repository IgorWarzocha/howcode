import type { Dispatch, SetStateAction } from "react";
import type {
  AppSettings,
  ComposerModel,
  ComposerThinkingLevel,
  DesktopActionInvoker,
} from "../../desktop/types";
import type { SettingDescriptor } from "./settingsTypes";
import { InlineSelect } from "./settingsUi";
import type { SettingsController } from "./settingsDescriptorTypes";

export function buildModelSettingsDescriptors({
  appSettings,
  availableModels,
  availableThinkingLevels,
  currentModel,
  controller,
  openSelectId,
  setOpenSelectId,
  onAction,
}: {
  appSettings: AppSettings;
  availableModels: ComposerModel[];
  availableThinkingLevels: ComposerThinkingLevel[];
  currentModel: ComposerModel | null;
  controller: SettingsController;
  openSelectId: string | null;
  setOpenSelectId: Dispatch<SetStateAction<string | null>>;
  onAction: DesktopActionInvoker;
}): SettingDescriptor[] {
  const modelProviders = [...new Set(availableModels.map((model) => model.provider))].sort();
  const allThinkingLevels: ComposerThinkingLevel[] = [
    "off",
    "minimal",
    "low",
    "medium",
    "high",
    "xhigh",
  ];
  const getSelectedWorkflowModel = (selection: AppSettings["gitCommitMessageModel"]) =>
    selection
      ? (availableModels.find(
          (model) => model.provider === selection.provider && model.id === selection.id,
        ) ?? null)
      : currentModel;
  const getWorkflowThinkingLevels = (selection: AppSettings["gitCommitMessageModel"]) => {
    const selectedModel = getSelectedWorkflowModel(selection);
    if (!selection) {
      return availableThinkingLevels;
    }

    return selectedModel?.reasoning ? allThinkingLevels : (["off"] as ComposerThinkingLevel[]);
  };
  const selectFirstProviderModel = (
    provider: string | null,
    selection: AppSettings["gitCommitMessageModel"],
    selectModel: (id: string) => void,
  ) => {
    if (!provider) {
      selectModel("composer-default");
      return;
    }

    if (selection?.provider === provider) {
      return;
    }

    const firstModel = availableModels.find((model) => model.provider === provider);
    if (firstModel) {
      selectModel(`${firstModel.provider}/${firstModel.id}`);
    }
  };
  const buildProviderOptions = (
    id: string,
    selection: AppSettings["gitCommitMessageModel"],
    selectModel: (id: string) => void,
  ) => (
    <InlineSelect
      id={id}
      value={selection?.provider ?? "composer-default"}
      open={openSelectId === id}
      options={[
        { value: "composer-default", label: "Composer default" },
        ...modelProviders.map((provider) => ({ value: provider, label: provider })),
      ]}
      onOpenChange={(open) => setOpenSelectId(open ? id : null)}
      onChange={(value) =>
        selectFirstProviderModel(
          value === "composer-default" ? null : value,
          selection,
          selectModel,
        )
      }
    />
  );
  const buildModelOptions = (
    id: string,
    selection: AppSettings["gitCommitMessageModel"],
    selectModel: (id: string) => void,
  ) => {
    const providerModels = selection
      ? availableModels.filter((model) => model.provider === selection.provider)
      : availableModels;

    return (
      <InlineSelect
        id={id}
        value={selection ? `${selection.provider}/${selection.id}` : "composer-default"}
        open={openSelectId === id}
        options={[
          {
            value: "composer-default",
            label: "Composer default",
            description: currentModel ? currentModel.name : undefined,
          },
          ...providerModels.map((model) => ({
            value: `${model.provider}/${model.id}`,
            label: model.name,
          })),
        ]}
        onOpenChange={(open) => setOpenSelectId(open ? id : null)}
        onChange={selectModel}
      />
    );
  };
  const thinkingLevelLabels: Record<ComposerThinkingLevel, string> = {
    off: "Off",
    minimal: "Minimal",
    low: "Low",
    medium: "Medium",
    high: "High",
    xhigh: "Extra high",
  };
  const renderThinkingSelector = (
    id: string,
    value: ComposerThinkingLevel,
    levels: ComposerThinkingLevel[],
    onChange: (value: ComposerThinkingLevel) => void,
  ) => (
    <InlineSelect
      id={id}
      value={levels.includes(value) ? value : (levels[0] ?? "off")}
      open={openSelectId === id}
      options={levels.map((level) => ({
        value: level,
        label: thinkingLevelLabels[level],
      }))}
      onOpenChange={(open) => setOpenSelectId(open ? id : null)}
      onChange={(nextValue) => onChange(nextValue as ComposerThinkingLevel)}
    />
  );
  const renderModelWorkflowControls = (
    idPrefix: string,
    selection: AppSettings["gitCommitMessageModel"],
    thinkingLevel: ComposerThinkingLevel,
    selectModel: (id: string) => void,
    selectThinkingLevel: (value: ComposerThinkingLevel) => void,
  ) => (
    <div className="grid w-full min-w-0 grid-cols-1 gap-2 xl:w-auto xl:grid-cols-3">
      {buildProviderOptions(`${idPrefix}-provider`, selection, selectModel)}
      {buildModelOptions(`${idPrefix}-model`, selection, selectModel)}
      {renderThinkingSelector(
        `${idPrefix}-thinking`,
        thinkingLevel,
        getWorkflowThinkingLevels(selection),
        selectThinkingLevel,
      )}
    </div>
  );

  return [
    {
      id: "models.git-commit",
      category: "models",
      title: "Git commit messages",
      description: "Provider, model, and reasoning level for generated git commit messages.",
      keywords: "git commit message model provider reasoning thinking",
      render: () =>
        renderModelWorkflowControls(
          "git-commit-models",
          appSettings.gitCommitMessageModel,
          appSettings.gitCommitMessageThinkingLevel,
          controller.selectGitCommitModel,
          (value) =>
            void onAction("settings.update", {
              key: "gitCommitMessageThinkingLevel",
              value,
            }),
        ),
    },
    {
      id: "models.skill-creator",
      category: "models",
      title: "Skill creator",
      description: "Provider, model, and reasoning level for the skill creator workflow.",
      keywords: "skill creator model provider reasoning thinking",
      render: () =>
        renderModelWorkflowControls(
          "skill-creator-models",
          appSettings.skillCreatorModel,
          appSettings.skillCreatorThinkingLevel,
          controller.selectSkillCreatorModel,
          (value) =>
            void onAction("settings.update", {
              key: "skillCreatorThinkingLevel",
              value,
            }),
        ),
    },
  ];
}
