import type { PiSettings } from "../../desktop/types";
import { settingsInputClass } from "../../ui/classes";
import { cn } from "../../utils/cn";
import type { SettingDescriptor } from "./settingsTypes";
import { ToggleBox } from "./settingsUi";
import type { SetDraftPiSetting } from "./settingsDescriptorTypes";

export function buildPiRuntimeSettingsDescriptors({
  draftPiSettings,
  setDraftPiSetting,
}: {
  draftPiSettings: PiSettings;
  setDraftPiSetting: SetDraftPiSetting;
}): SettingDescriptor[] {
  return [
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
  ];
}
