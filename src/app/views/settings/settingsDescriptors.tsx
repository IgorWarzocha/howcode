import { Download, FolderPlus, Trash2 } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import {
  DEFAULT_DICTATION_MAX_DURATION_SECONDS,
  DICTATION_MAX_DURATION_OPTIONS,
} from "../../../../shared/dictation-settings";
import type {
  AppSettings,
  ComposerModel,
  ComposerThinkingLevel,
  DesktopActionInvoker,
  DictationModelId,
  PiSettings,
} from "../../desktop/types";
import { ActivitySpinner } from "../../components/common/ActivitySpinner";
import { composerTextActionButtonClass, settingsInputClass } from "../../ui/classes";
import { cn } from "../../utils/cn";
import type { useSettingsController } from "./useSettingsController";
import type { SettingDescriptor } from "./settingsTypes";
import { InlineSelect, ToggleBox, normalizeManagedDictationModelId } from "./settingsUi";

type SettingsController = ReturnType<typeof useSettingsController>;
type SetDraftPiSetting = <Key extends keyof PiSettings>(key: Key, value: PiSettings[Key]) => void;

export function buildSettingsDescriptors({
  appSettings,
  availableModels,
  availableThinkingLevels,
  currentModel,
  controller,
  draftPiSettings,
  setDraftPiSetting,
  openSelectId,
  setOpenSelectId,
  dictationModelDraft,
  setDictationModelDraft,
  configuredDictationModelId,
  onAction,
}: {
  appSettings: AppSettings;
  availableModels: ComposerModel[];
  availableThinkingLevels: ComposerThinkingLevel[];
  currentModel: ComposerModel | null;
  controller: SettingsController;
  draftPiSettings: PiSettings;
  setDraftPiSetting: SetDraftPiSetting;
  openSelectId: string | null;
  setOpenSelectId: Dispatch<SetStateAction<string | null>>;
  dictationModelDraft: DictationModelId | null;
  setDictationModelDraft: Dispatch<SetStateAction<DictationModelId | null>>;
  configuredDictationModelId: DictationModelId | null;
  onAction: DesktopActionInvoker;
}) {
  const dictationModelSelectValue =
    dictationModelDraft ?? configuredDictationModelId ?? controller.dictationModels[0]?.id ?? "";
  const selectedDictationOptionModel =
    controller.dictationModels.find((model) => model.id === dictationModelSelectValue) ?? null;
  const selectedDictationOptionIsInstalled = Boolean(selectedDictationOptionModel?.installed);
  const removableDictationModel =
    selectedDictationOptionModel?.installed && selectedDictationOptionModel.managed
      ? selectedDictationOptionModel
      : null;
  const dictationPendingForSelectedModel =
    selectedDictationOptionModel &&
    controller.dictationPendingAction?.modelId === selectedDictationOptionModel.id
      ? controller.dictationPendingAction.kind
      : null;
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
      className="w-full"
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
        className="w-full"
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
      className="w-[9.5rem]"
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
    <div className="grid grid-cols-[9rem_minmax(12rem,1fr)_9.5rem] gap-2">
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

  const settings: SettingDescriptor[] = [
    {
      id: "common.streaming-behavior",
      category: "common",
      title: "Send while Pi is responding",
      description:
        "Desktop composer policy. Steer interrupts, Queue waits for the current turn, Stop aborts without sending.",
      keywords: "queue steer stop streaming responding send composer",
      render: () => (
        <div className="min-w-[13rem]">
          <div className="grid grid-cols-3 rounded-full border border-[color:var(--border)] bg-[rgba(255,255,255,0.03)] p-1 text-[12px] text-[color:var(--muted)]">
            {[
              ["steer", "Steer"],
              ["followUp", "Queue"],
              ["stop", "Stop"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={cn(
                  "rounded-full px-3 py-1 transition-colors active:scale-[0.96]",
                  appSettings.composerStreamingBehavior === value &&
                    "bg-[rgba(255,255,255,0.18)] text-[color:var(--text)] shadow-[inset_0_0_0_1px_rgba(183,186,245,0.5)]",
                )}
                onClick={() =>
                  controller.setComposerStreamingBehavior(
                    value as AppSettings["composerStreamingBehavior"],
                  )
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "common.pi-tui-takeover",
      category: "common",
      title: "Open in TUI",
      description:
        "Use Pi takeover by default until a conversation is overridden for this app session.",
      keywords: "takeover terminal tui open conversations",
      render: () => (
        <ToggleBox
          checked={appSettings.piTuiTakeover}
          label="Open in TUI"
          onClick={controller.togglePiTuiTakeover}
        />
      ),
    },
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
    {
      id: "pi-runtime.transport",
      category: "pi-runtime",
      title: "Transport",
      description: "How Pi connects to providers that support multiple streaming transports.",
      keywords: "transport sse websocket auto provider runtime",
      render: () => (
        <div className="grid grid-cols-3 rounded-full border border-[color:var(--border)] bg-[rgba(255,255,255,0.03)] p-1 text-[12px] text-[color:var(--muted)]">
          {[
            ["sse", "SSE"],
            ["websocket", "WebSocket"],
            ["auto", "Auto"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={cn(
                "rounded-full px-3 py-1 transition-colors active:scale-[0.96]",
                draftPiSettings.transport === value &&
                  "bg-[rgba(255,255,255,0.18)] text-[color:var(--text)] shadow-[inset_0_0_0_1px_rgba(183,186,245,0.5)]",
              )}
              onClick={() => setDraftPiSetting("transport", value as PiSettings["transport"])}
            >
              {label}
            </button>
          ))}
        </div>
      ),
    },
    {
      id: "pi-runtime.auto-compact",
      category: "pi-runtime",
      title: "Auto compact context",
      description: "Let Pi compact long sessions automatically when context gets tight.",
      keywords: "auto compact context runtime",
      render: () => (
        <ToggleBox
          checked={draftPiSettings.autoCompact}
          label="Auto compact context"
          onClick={() => setDraftPiSetting("autoCompact", !draftPiSettings.autoCompact)}
        />
      ),
    },
    {
      id: "pi-runtime.skill-commands",
      category: "pi-runtime",
      title: "Enable skill slash commands",
      description:
        "Expose installed skills as /skill:name commands in Pi and the desktop slash picker.",
      keywords: "skills slash commands picker runtime",
      render: () => (
        <ToggleBox
          checked={draftPiSettings.enableSkillCommands}
          label="Enable skill slash commands"
          onClick={() =>
            setDraftPiSetting("enableSkillCommands", !draftPiSettings.enableSkillCommands)
          }
        />
      ),
    },
    ...(["steeringMode", "followUpMode"] as const).map((key) => ({
      id: `pi-runtime.${key}`,
      category: "pi-runtime" as const,
      title: key === "steeringMode" ? "Steering mode" : "Follow-up mode",
      description:
        key === "steeringMode"
          ? "Advanced Pi queue-drain behavior after steering messages are already queued."
          : "Advanced Pi queue-drain behavior after follow-up messages are already queued.",
      keywords: "queue drain steering follow-up mode runtime advanced",
      render: () => (
        <div className="grid grid-cols-2 rounded-full border border-[color:var(--border)] bg-[rgba(255,255,255,0.03)] p-1 text-[12px] text-[color:var(--muted)]">
          {[
            ["one-at-a-time", "One"],
            ["all", "All"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={cn(
                "rounded-full px-3 py-1 transition-colors active:scale-[0.96]",
                draftPiSettings[key] === value &&
                  "bg-[rgba(255,255,255,0.18)] text-[color:var(--text)] shadow-[inset_0_0_0_1px_rgba(183,186,245,0.5)]",
              )}
              onClick={() => setDraftPiSetting(key, value as PiSettings[typeof key])}
            >
              {label}
            </button>
          ))}
        </div>
      ),
    })),
    ...(
      [
        [
          "autoResizeImages",
          "Auto resize images",
          "Resize images before sending them to providers for better compatibility.",
        ],
        ["blockImages", "Block images", "Prevent images from being sent to model providers."],
        [
          "enableInstallTelemetry",
          "Install telemetry",
          "Allow Pi's anonymous package update/version ping.",
        ],
      ] as const
    ).map(([key, title, description]) => ({
      id: `pi-runtime.${key}`,
      category: "pi-runtime" as const,
      title,
      description,
      keywords: "image images telemetry runtime provider",
      render: () => (
        <ToggleBox
          checked={draftPiSettings[key]}
          label={title}
          onClick={() => setDraftPiSetting(key, !draftPiSettings[key])}
        />
      ),
    })),
    ...(
      [
        [
          "doubleEscapeAction",
          "Double Escape",
          "Pi TUI action for double Escape on an empty editor.",
        ],
        ["showImages", "Show images", "Render supported image attachments in capable terminals."],
        [
          "hideThinkingBlock",
          "Hide thinking blocks",
          "Collapse model reasoning blocks in Pi TUI conversation output.",
        ],
        [
          "showHardwareCursor",
          "Hardware cursor",
          "Show the terminal cursor while Pi still positions it for IME input.",
        ],
        [
          "clearOnShrink",
          "Clear on shrink",
          "Clear empty terminal rows when rendered content shrinks.",
        ],
        ["quietStartup", "Quiet startup", "Reduce startup resource diagnostics in Pi TUI."],
        ["collapseChangelog", "Condense changelog", "Show a shorter changelog after Pi updates."],
      ] as const
    ).map(([key, title, description]) => ({
      id: `pi-tui.${key}`,
      category: "pi-tui" as const,
      title,
      description,
      keywords: "terminal tui editor cursor changelog thinking images escape",
      render: () =>
        key === "doubleEscapeAction" ? (
          <div className="grid grid-cols-3 rounded-full border border-[color:var(--border)] bg-[rgba(255,255,255,0.03)] p-1 text-[12px] text-[color:var(--muted)]">
            {[
              ["tree", "Tree"],
              ["fork", "Fork"],
              ["none", "None"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={cn(
                  "rounded-full px-3 py-1 transition-colors active:scale-[0.96]",
                  draftPiSettings.doubleEscapeAction === value &&
                    "bg-[rgba(255,255,255,0.18)] text-[color:var(--text)] shadow-[inset_0_0_0_1px_rgba(183,186,245,0.5)]",
                )}
                onClick={() =>
                  setDraftPiSetting("doubleEscapeAction", value as PiSettings["doubleEscapeAction"])
                }
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <ToggleBox
            checked={Boolean(draftPiSettings[key as keyof PiSettings])}
            label={title}
            onClick={() =>
              setDraftPiSetting(
                key as
                  | "showImages"
                  | "hideThinkingBlock"
                  | "showHardwareCursor"
                  | "clearOnShrink"
                  | "quietStartup"
                  | "collapseChangelog",
                !draftPiSettings[
                  key as
                    | "showImages"
                    | "hideThinkingBlock"
                    | "showHardwareCursor"
                    | "clearOnShrink"
                    | "quietStartup"
                    | "collapseChangelog"
                ],
              )
            }
          />
        ),
    })),
    ...(
      [
        [
          "imageWidthCells",
          "Image width",
          "Preferred inline image width in terminal cells.",
          1,
          200,
        ],
        ["editorPaddingX", "Editor padding", "Horizontal Pi TUI editor padding.", 0, 3],
        [
          "autocompleteMaxVisible",
          "Autocomplete rows",
          "Maximum visible Pi TUI autocomplete results.",
          3,
          20,
        ],
      ] as const
    ).map(([key, title, description, min, max]) => ({
      id: `pi-tui.${key}`,
      category: "pi-tui" as const,
      title,
      description,
      keywords: "terminal tui editor autocomplete image width padding rows",
      render: () => (
        <input
          type="number"
          min={min}
          max={max}
          value={draftPiSettings[key]}
          onChange={(event) => {
            const nextValue = event.currentTarget.valueAsNumber;
            if (Number.isFinite(nextValue)) {
              setDraftPiSetting(key, nextValue);
            }
          }}
          className={cn(settingsInputClass, "w-28")}
        />
      ),
    })),
    {
      id: "projects.default-location",
      category: "projects",
      title: "Default project location",
      description: "Folder where new howcode projects are created by default.",
      keywords: "project folder location path default",
      render: () => (
        <div className="relative w-[22rem] max-w-full">
          <FolderPlus
            size={14}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[color:var(--muted)]"
          />
          <input
            type="text"
            value={controller.preferredProjectLocationDraft}
            onChange={(event) => controller.setPreferredProjectLocationDraft(event.target.value)}
            onBlur={controller.savePreferredProjectLocation}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                controller.savePreferredProjectLocation();
              }
            }}
            className={cn(settingsInputClass, "w-full pl-9")}
            placeholder="Paste an absolute folder path"
            aria-label="Default project location"
          />
        </div>
      ),
    },
    {
      id: "projects.initialize-git",
      category: "projects",
      title: "Initialise git",
      description: "Create a git repository for new projects so diffs work immediately.",
      keywords: "git init initialize projects diffs",
      render: () => (
        <ToggleBox
          checked={appSettings.initializeGitOnProjectCreate}
          label="Initialise git"
          onClick={controller.toggleInitializeGitOnProjectCreate}
        />
      ),
    },
    {
      id: "projects.deletion-mode",
      category: "projects",
      title: "Project deletion cleanup",
      description: "Delete only Pi session files, or nuke the full project folder from disk.",
      keywords: "delete deletion cleanup project full clean pi only",
      render: () => (
        <div className="grid grid-cols-2 rounded-full border border-[color:var(--border)] bg-[rgba(255,255,255,0.03)] p-1 text-[12px] text-[color:var(--muted)]">
          {[
            ["pi-only", "Pi only"],
            ["full-clean", "Full clean"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={cn(
                "rounded-full px-3 py-1 transition-colors active:scale-[0.96]",
                appSettings.projectDeletionMode === value &&
                  "bg-[rgba(255,255,255,0.18)] text-[color:var(--text)] shadow-[inset_0_0_0_1px_rgba(183,186,245,0.5)]",
              )}
              onClick={() =>
                controller.setProjectDeletionMode(value as AppSettings["projectDeletionMode"])
              }
            >
              {label}
            </button>
          ))}
        </div>
      ),
    },
    {
      id: "projects.import-ui",
      category: "projects",
      title: "Project UI import",
      description: "Scan current projects for UI info like repo and origin status.",
      keywords: "project import ui scan repo origin first launch",
      render: () => (
        <div className="grid justify-items-end gap-1.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={composerTextActionButtonClass}
              onClick={() => void controller.handleImportProjectUi()}
              disabled={controller.importBusy || !controller.desktopBridgeAvailable}
            >
              {controller.importBusy
                ? "Importing…"
                : appSettings.projectImportState
                  ? "Run again"
                  : "Import now"}
            </button>
            {appSettings.projectImportState === false ? (
              <button
                type="button"
                className={cn(composerTextActionButtonClass, "text-[12px]")}
                onClick={controller.showFirstLaunchReminderAgain}
              >
                Show reminder
              </button>
            ) : null}
          </div>
          {controller.importStatusMessage ? (
            <div className="text-right text-[12px] text-[color:var(--muted)]">
              {controller.importStatusMessage}
            </div>
          ) : null}
          {!controller.desktopBridgeAvailable ? (
            <div className="text-right text-[12px] text-[color:var(--muted)]">
              Project sync needs the desktop bridge.
            </div>
          ) : null}
          {controller.importErrorMessage ? (
            <div className="text-right text-[12px] text-[#f2a7a7]">
              {controller.importErrorMessage}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      id: "projects.favorite-folders",
      category: "projects",
      title: "Favorite folders",
      description: "Pinned paths shown in the attachment picker alongside Home.",
      keywords: "favorite folders attachment picker paths",
      render: () => (
        <div className="grid w-[28rem] max-w-full gap-2">
          <div className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-2">
            <input
              type="text"
              value={controller.favoriteFolderDraft}
              onChange={(event) => controller.setFavoriteFolderDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  controller.addFavoriteFolder();
                }
              }}
              className={cn(settingsInputClass, "h-8")}
              placeholder="Absolute folder path"
              aria-label="Favorite folder path"
            />
            <button
              type="button"
              className={cn(composerTextActionButtonClass, "h-8 justify-center")}
              onClick={controller.addFavoriteFolder}
              disabled={controller.favoriteFolderDraft.trim().length === 0}
            >
              Add
            </button>
          </div>
          {appSettings.favoriteFolders.length > 0 ? (
            <div className="flex flex-wrap justify-end gap-1.5">
              {appSettings.favoriteFolders.map((folder) => (
                <span
                  key={folder}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[rgba(255,255,255,0.025)] py-1 pr-1 pl-2 text-[11.5px] text-[color:var(--muted)]"
                >
                  <span className="max-w-[18rem] truncate" title={folder}>
                    {folder}
                  </span>
                  <button
                    type="button"
                    className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[color:var(--muted)] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[color:var(--text)]"
                    onClick={() =>
                      controller.updateFavoriteFolders(
                        appSettings.favoriteFolders.filter((current) => current !== folder),
                      )
                    }
                    aria-label={`Remove ${folder}`}
                    data-tooltip={`Remove ${folder}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      id: "dictation.models",
      category: "dictation",
      title: "Speech-to-text model",
      description: "Download and choose one of the curated sherpa-onnx int8 Whisper models.",
      keywords: "dictation model whisper download tiny base small speech transcription",
      render: () => (
        <div className="grid w-[27rem] max-w-full gap-2">
          <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] items-center gap-2">
            <InlineSelect
              id="dictation-model"
              className="min-w-0"
              value={dictationModelSelectValue}
              open={openSelectId === "dictation-model"}
              options={controller.dictationModels.map((model) => ({
                value: model.id,
                label: `${model.name} · ${model.downloadSizeLabel}`,
              }))}
              onOpenChange={(open) => setOpenSelectId(open ? "dictation-model" : null)}
              onChange={(value) => {
                const modelId = normalizeManagedDictationModelId(value);
                if (modelId) {
                  setDictationModelDraft(modelId);
                  const model = controller.dictationModels.find(
                    (candidate) => candidate.id === modelId,
                  );
                  if (model?.installed) {
                    controller.setDictationModelId(modelId);
                  }
                }
              }}
            />
            {selectedDictationOptionModel && !selectedDictationOptionIsInstalled ? (
              <button
                type="button"
                className={cn(composerTextActionButtonClass, "h-8 justify-center")}
                disabled={controller.dictationPendingAction !== null}
                onClick={() => controller.installDictationModel(selectedDictationOptionModel.id)}
              >
                {dictationPendingForSelectedModel === "download" ? (
                  <ActivitySpinner className="h-3 w-3 text-current" />
                ) : (
                  <Download size={12} />
                )}
                <span>
                  {dictationPendingForSelectedModel === "download" ? "Downloading…" : "Download"}
                </span>
              </button>
            ) : (
              <button
                type="button"
                className={cn(composerTextActionButtonClass, "h-8 justify-center")}
                disabled={controller.dictationPendingAction !== null || !removableDictationModel}
                onClick={() => {
                  if (removableDictationModel) {
                    controller.deleteDictationModel(removableDictationModel.id);
                  }
                }}
              >
                {controller.dictationPendingAction?.kind === "delete" ? (
                  <ActivitySpinner className="h-3 w-3 text-current" />
                ) : (
                  <Trash2 size={12} />
                )}
                <span>
                  {controller.dictationPendingAction?.kind === "delete" ? "Removing…" : "Remove"}
                </span>
              </button>
            )}
          </div>
          {controller.dictationInstallError ? (
            <output className="text-[12px] text-[#f2a7a7]" aria-live="polite">
              {controller.dictationInstallError}
            </output>
          ) : null}
        </div>
      ),
    },
    {
      id: "dictation.max-duration",
      category: "dictation",
      title: "Max dictation length",
      description: `Longer captures use more memory before transcription. Default is ${DEFAULT_DICTATION_MAX_DURATION_SECONDS / 60} minutes.`,
      keywords: "dictation duration length capture minutes seconds",
      render: () => (
        <select
          className={cn(settingsInputClass, "w-36")}
          value={String(appSettings.dictationMaxDurationSeconds)}
          onChange={(event) =>
            controller.setDictationMaxDurationSeconds(Number.parseInt(event.target.value, 10))
          }
          aria-label="Max dictation length"
        >
          {DICTATION_MAX_DURATION_OPTIONS.map((seconds) => (
            <option key={seconds} value={seconds}>
              {seconds < 60 ? `${seconds} seconds` : `${seconds / 60} minutes`}
            </option>
          ))}
        </select>
      ),
    },
    {
      id: "dictation.show-button",
      category: "dictation",
      title: "Toggle dictation",
      description: "If hidden, re-enable the composer microphone button here.",
      keywords: "dictation button composer microphone show hide",
      render: () => (
        <ToggleBox
          checked={appSettings.showDictationButton}
          label="Toggle dictation"
          onClick={() => controller.setShowDictationButton(!appSettings.showDictationButton)}
        />
      ),
    },
  ];

  return settings;
}
