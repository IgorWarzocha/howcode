import { Check, ChevronDown, Download, FolderPlus, Search, Trash2, X } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_DICTATION_MAX_DURATION_SECONDS,
  DICTATION_MAX_DURATION_OPTIONS,
} from "../../../shared/dictation-settings";
import { ViewHeader } from "../components/common/ViewHeader";
import { ViewShell } from "../components/common/ViewShell";
import type {
  AppSettings,
  ComposerModel,
  ComposerThinkingLevel,
  DesktopActionInvoker,
  DictationModelId,
  PiSettings,
} from "../desktop/types";
import {
  popoverPanelClass,
  composerTextActionButtonClass,
  settingsInputClass,
  settingsSectionClass,
} from "../ui/classes";
import { cn } from "../utils/cn";
import type { Project } from "../types";
import { ActivitySpinner } from "../components/common/ActivitySpinner";
import { useSettingsController } from "./settings/useSettingsController";

type SettingsViewProps = {
  appSettings: AppSettings;
  piSettings: PiSettings;
  availableModels: ComposerModel[];
  availableThinkingLevels: ComposerThinkingLevel[];
  currentModel: ComposerModel | null;
  projects: Project[];
  onAction: DesktopActionInvoker;
  onClose: () => void;
};

type SettingsCategoryId = "common" | "models" | "pi-runtime" | "pi-tui" | "projects" | "dictation";

type SettingDescriptor = {
  id: string;
  category: SettingsCategoryId;
  title: string;
  description: string;
  keywords?: string;
  render: () => ReactNode;
};

type InlineSelectOption = {
  value: string;
  label: string;
  description?: string;
};

const categories: { id: SettingsCategoryId; label: string }[] = [
  { id: "common", label: "Common" },
  { id: "models", label: "Models" },
  { id: "pi-runtime", label: "Pi Runtime" },
  { id: "pi-tui", label: "Pi TUI" },
  { id: "projects", label: "Projects" },
  { id: "dictation", label: "Dictation" },
];

function ToggleBox({
  checked,
  label,
  onClick,
}: { checked: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[color:var(--border)] bg-transparent text-[color:var(--text)] transition-colors active:scale-[0.96] hover:border-[color:var(--border-strong)]"
      onClick={onClick}
      aria-label={label}
      aria-pressed={checked}
    >
      {checked ? <Check size={13} /> : null}
    </button>
  );
}

function SettingRow({ setting }: { setting: SettingDescriptor }) {
  return (
    <div
      className="grid min-h-10 grid-cols-[minmax(0,1fr)_auto] items-start gap-5 border-b border-[rgba(169,178,215,0.09)] px-1 py-1.5 last:border-b-0"
      data-setting-id={setting.id}
    >
      <div className="min-w-0 truncate pt-2 text-[13px] text-[color:var(--text)]">
        {setting.title}
      </div>
      <div className="min-w-0 justify-self-end">{setting.render()}</div>
    </div>
  );
}

function InlineSelect({
  id,
  value,
  options,
  open,
  className,
  onChange,
  onOpenChange,
}: {
  id: string;
  value: string;
  options: InlineSelectOption[];
  open: boolean;
  className?: string;
  onChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const selectedOption = options.find((option) => option.value === value) ?? options[0] ?? null;
  const compactOptionClass =
    "flex min-h-0 w-full items-center rounded-md border border-transparent px-2 py-1 text-left text-[11.5px] leading-4 text-[color:var(--text)] transition-colors hover:bg-[rgba(255,255,255,0.045)]";

  return (
    <span className={cn("relative block", className)} data-inline-select-root>
      <button
        type="button"
        className={cn(
          composerTextActionButtonClass,
          "grid h-8 w-full grid-cols-[minmax(0,1fr)_auto] justify-start gap-2 rounded-lg px-2.5 pr-8 text-left font-normal",
          open && "border-[rgba(169,178,215,0.22)] bg-[rgba(255,255,255,0.1)]",
        )}
        onClick={() => onOpenChange(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`${id}-menu`}
      >
        <span className="min-w-0 truncate text-[13px] text-[color:var(--text)]">
          {selectedOption?.label ?? "Select"}
        </span>
      </button>
      <ChevronDown
        size={14}
        className={cn(
          "pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[color:var(--muted)] transition-transform",
          open && "rotate-180",
        )}
      />
      {open ? (
        <div
          id={`${id}-menu`}
          role="menu"
          className={cn(
            popoverPanelClass,
            "absolute top-[calc(100%+6px)] left-0 z-[60] grid max-h-64 w-full min-w-44 overflow-y-auto rounded-xl border border-[color:var(--border-strong)] bg-[rgba(45,48,64,0.98)] p-1 shadow-[0_18px_40px_rgba(0,0,0,0.28)]",
          )}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === value}
              className={cn(
                compactOptionClass,
                option.value === value && "bg-[rgba(255,255,255,0.06)]",
              )}
              onClick={() => {
                onChange(option.value);
                onOpenChange(false);
              }}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate leading-4">{option.label}</span>
                {option.description ? (
                  <span className="block truncate text-[10px] leading-3 text-[color:var(--muted)]">
                    {option.description}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </span>
  );
}

function normalizeManagedDictationModelId(
  modelId: string | null | undefined,
): DictationModelId | null {
  return modelId === "tiny.en" || modelId === "base.en" || modelId === "small.en" ? modelId : null;
}

export function SettingsView({
  appSettings,
  piSettings,
  availableModels,
  availableThinkingLevels,
  currentModel,
  projects,
  onAction,
  onClose,
}: SettingsViewProps) {
  const controller = useSettingsController({ appSettings, projects, onAction });
  const [draftPiSettings, setDraftPiSettings] = useState(piSettings);
  const draftPiSettingsRef = useRef(draftPiSettings);
  const dirtyPiSettingsRef = useRef(new Set<keyof PiSettings>());
  const [filter, setFilter] = useState("");
  const [activeCategory, setActiveCategory] = useState<SettingsCategoryId | null>(null);
  const [openSelectId, setOpenSelectId] = useState<string | null>(null);
  const [dictationModelDraft, setDictationModelDraft] = useState<DictationModelId | null>(null);
  const normalizedFilter = filter.trim().toLowerCase();

  useEffect(() => {
    draftPiSettingsRef.current = draftPiSettings;
  }, [draftPiSettings]);

  useEffect(() => {
    if (dirtyPiSettingsRef.current.size === 0) {
      setDraftPiSettings(piSettings);
    }
  }, [piSettings]);

  const setDraftPiSetting = useCallback(
    <Key extends keyof PiSettings>(key: Key, value: PiSettings[Key]) => {
      dirtyPiSettingsRef.current.add(key);
      setDraftPiSettings((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const flushPiSettings = useCallback(async () => {
    const dirtyKeys = [...dirtyPiSettingsRef.current];
    if (dirtyKeys.length === 0) {
      return;
    }

    dirtyPiSettingsRef.current.clear();
    const snapshot = draftPiSettingsRef.current;
    for (const key of dirtyKeys) {
      await onAction("pi-settings.update", {
        piSettingsKey: key,
        value: snapshot[key],
      });
    }
  }, [onAction]);

  useEffect(() => {
    return () => {
      void flushPiSettings();
    };
  }, [flushPiSettings]);

  const closeSettings = useCallback(() => {
    void flushPiSettings().finally(onClose);
  }, [flushPiSettings, onClose]);

  useEffect(() => {
    if (!openSelectId) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (!target.closest("[data-inline-select-root]")) {
        setOpenSelectId(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpenSelectId(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [openSelectId]);

  const configuredDictationModelId = normalizeManagedDictationModelId(appSettings.dictationModelId);
  useEffect(() => {
    setDictationModelDraft(configuredDictationModelId);
  }, [configuredDictationModelId]);

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
      title: "Open conversations in Pi TUI",
      description:
        "Use Pi takeover by default until a conversation is overridden for this app session.",
      keywords: "takeover terminal tui open conversations",
      render: () => (
        <ToggleBox
          checked={appSettings.piTuiTakeover}
          label="Open conversations in Pi TUI"
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
      title: "Initialise git for new projects",
      description: "Create a git repository for new projects so diffs work immediately.",
      keywords: "git init initialize projects diffs",
      render: () => (
        <ToggleBox
          checked={appSettings.initializeGitOnProjectCreate}
          label="Initialise git for new projects"
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
      title: "Show composer dictation button",
      description: "If hidden, re-enable the composer microphone button here.",
      keywords: "dictation button composer microphone show hide",
      render: () => (
        <ToggleBox
          checked={appSettings.showDictationButton}
          label="Show composer dictation button"
          onClick={() => controller.setShowDictationButton(!appSettings.showDictationButton)}
        />
      ),
    },
  ];

  const filteredSettings = settings.filter((setting) => {
    if (!normalizedFilter && activeCategory && setting.category !== activeCategory) {
      return false;
    }

    if (!normalizedFilter) {
      return true;
    }

    const categoryLabel =
      categories.find((category) => category.id === setting.category)?.label ?? "";
    return `${categoryLabel} ${setting.title} ${setting.description} ${setting.keywords ?? ""}`
      .toLowerCase()
      .includes(normalizedFilter);
  });

  const visibleGroups = categories
    .map((category) => ({
      ...category,
      settings: filteredSettings.filter((setting) => setting.category === category.id),
    }))
    .filter((group) => group.settings.length > 0);

  return (
    <ViewShell
      className="h-full grid-rows-[auto_minmax(0,1fr)] overflow-hidden pb-0"
      maxWidthClassName="max-w-[1120px]"
    >
      <div className="grid items-center gap-4 lg:grid-cols-[220px_minmax(0,1fr)_auto]">
        <ViewHeader title="App settings" className="items-center" />
        <div className="hidden h-10 items-center lg:flex">
          <label className="relative block w-[min(460px,42vw)]">
            <Search
              size={15}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[color:var(--muted)]"
            />
            <input
              type="search"
              value={filter}
              onChange={(event) => setFilter(event.currentTarget.value)}
              className="h-10 w-full min-w-0 flex-1 rounded-xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.055)] px-3 py-2 pl-9 text-[13px] text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted)]"
              placeholder="Search…"
              aria-label="Search settings"
            />
          </label>
        </div>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center self-center rounded-full border border-[color:var(--border)] bg-[rgba(255,255,255,0.03)] text-[color:var(--text)] transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.07)]"
          onClick={closeSettings}
          aria-label="Close app settings"
          title="Close app settings"
        >
          <X size={14} />
        </button>
      </div>

      <div className="grid min-h-0 items-start gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="sticky top-0 hidden rounded-[22px] border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] p-2 lg:grid">
          <button
            type="button"
            className={cn(
              "flex h-10 items-center rounded-xl px-3 text-left text-[12px] transition-colors active:scale-[0.96]",
              activeCategory === null && !normalizedFilter
                ? "bg-[rgba(169,178,215,0.14)] text-[color:var(--text)]"
                : "text-[color:var(--muted)] hover:bg-[rgba(169,178,215,0.08)] hover:text-[color:var(--text)]",
            )}
            onClick={() => setActiveCategory(null)}
          >
            All settings
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={cn(
                "flex h-10 items-center rounded-xl px-3 text-left text-[12px] transition-colors active:scale-[0.96]",
                activeCategory === category.id && !normalizedFilter
                  ? "bg-[rgba(169,178,215,0.14)] text-[color:var(--text)]"
                  : "text-[color:var(--muted)] hover:bg-[rgba(169,178,215,0.08)] hover:text-[color:var(--text)]",
              )}
              onClick={() => setActiveCategory(category.id)}
            >
              {category.label}
            </button>
          ))}
        </nav>

        <div className="grid max-h-full min-h-0 gap-4 overflow-y-auto pr-1 pb-6">
          <label className="relative block lg:hidden">
            <Search
              size={15}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[color:var(--muted)]"
            />
            <input
              type="search"
              value={filter}
              onChange={(event) => setFilter(event.currentTarget.value)}
              className="h-10 w-full min-w-0 flex-1 rounded-xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.055)] px-3 py-2 pl-9 text-[13px] text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted)]"
              placeholder="Search…"
              aria-label="Search settings"
            />
          </label>

          <div className="flex flex-wrap items-center gap-1.5 lg:hidden">
            <button
              type="button"
              className={cn(
                "rounded-full border border-[color:var(--border)] px-3 py-1.5 text-[12px] transition-colors",
                activeCategory === null && "bg-[rgba(169,178,215,0.14)] text-[color:var(--text)]",
              )}
              onClick={() => setActiveCategory(null)}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={cn(
                  "rounded-full border border-[color:var(--border)] px-3 py-1.5 text-[12px] text-[color:var(--muted)] transition-colors",
                  activeCategory === category.id &&
                    "bg-[rgba(169,178,215,0.14)] text-[color:var(--text)]",
                )}
                onClick={() => setActiveCategory(category.id)}
              >
                {category.label}
              </button>
            ))}
          </div>

          {visibleGroups.length > 0 ? (
            visibleGroups.map((group) => (
              <section key={group.id} className={cn(settingsSectionClass, "gap-1 p-2.5")}>
                <div className="flex items-baseline justify-between gap-3 px-1 pb-1">
                  <h2 className="text-[15px] font-semibold text-[color:var(--text)]">
                    {group.label}
                  </h2>
                </div>
                <div className="grid gap-2">
                  {group.settings.map((setting) => (
                    <SettingRow key={setting.id} setting={setting} />
                  ))}
                </div>
              </section>
            ))
          ) : (
            <div className="rounded-[22px] border border-[rgba(169,178,215,0.12)] bg-[rgba(255,255,255,0.025)] p-8 text-center">
              <div className="text-[14px] text-[color:var(--text)]">No matching settings</div>
              <div className="mt-1 text-[12px] text-[color:var(--muted)]">
                Try a broader term like “Pi”, “model”, “folder”, or “voice”.
              </div>
            </div>
          )}
        </div>
      </div>
    </ViewShell>
  );
}
