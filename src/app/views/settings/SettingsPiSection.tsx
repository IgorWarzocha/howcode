import { Check } from "lucide-react";
import { SectionIntro } from "../../components/common/SectionIntro";
import { SegmentedToggle } from "../../components/common/SegmentedToggle";
import type { PiSettings } from "../../desktop/types";
import { settingsInputClass, settingsListRowClass, settingsSectionClass } from "../../ui/classes";
import { cn } from "../../utils/cn";

type SettingsPiSectionProps = {
  piSettings: PiSettings;
  onUpdate: <Key extends keyof PiSettings>(key: Key, value: PiSettings[Key]) => void;
};

type BooleanSettingKey = {
  [Key in keyof PiSettings]: PiSettings[Key] extends boolean ? Key : never;
}[keyof PiSettings];

function BooleanSettingRow({
  title,
  description,
  value,
  onToggle,
}: {
  title: string;
  description: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={settingsListRowClass}>
      <div className="grid gap-0.5">
        <div className="text-[13px] text-[color:var(--text)]">{title}</div>
        <div className="text-[12px] text-[color:var(--muted)]">{description}</div>
      </div>
      <button
        type="button"
        className={cn(
          "inline-flex h-5 w-5 items-center justify-center rounded-md border transition-colors",
          value
            ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-[#1a1c26]"
            : "border-[color:var(--border)] bg-transparent text-transparent hover:border-[color:var(--border-strong)]",
        )}
        onClick={onToggle}
        aria-label={title}
        aria-pressed={value}
      >
        <Check size={13} />
      </button>
    </div>
  );
}

export function SettingsPiSection({ piSettings, onUpdate }: SettingsPiSectionProps) {
  const toggle = (key: BooleanSettingKey) => onUpdate(key, !piSettings[key]);

  return (
    <section className={settingsSectionClass}>
      <SectionIntro
        title="Pi settings"
        description="Pi-native settings shared with Pi CLI/TUI. Runtime settings can affect desktop sessions after a safe refresh; TUI-only settings apply only when a conversation is opened in Pi TUI."
      />

      <div className="grid gap-2">
        <div className="grid gap-0.5 px-1 pt-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted-2)]">
            Shared Pi runtime
          </div>
          <div className="text-[12px] text-[color:var(--muted)]">
            Used by desktop sessions and Pi TUI after Pi settings are refreshed.
          </div>
        </div>

        <div className={settingsListRowClass}>
          <div className="grid gap-0.5">
            <div className="text-[13px] text-[color:var(--text)]">Transport</div>
            <div className="text-[12px] text-[color:var(--muted)]">
              How Pi connects to model providers that support multiple streaming transports.
            </div>
          </div>
          <SegmentedToggle
            ariaLabel="Pi transport"
            value={piSettings.transport}
            options={
              [
                { value: "sse", label: "SSE" },
                { value: "websocket", label: "WebSocket" },
                { value: "auto", label: "Auto" },
              ] as const
            }
            onChange={(value) => onUpdate("transport", value)}
            size="compact"
          />
        </div>

        <BooleanSettingRow
          title="Auto compact context"
          description="Let Pi compact long sessions automatically when context gets tight."
          value={piSettings.autoCompact}
          onToggle={() => toggle("autoCompact")}
        />
        <BooleanSettingRow
          title="Enable skill slash commands"
          description="Expose installed skills as /skill:name commands in Pi and the desktop slash picker."
          value={piSettings.enableSkillCommands}
          onToggle={() => toggle("enableSkillCommands")}
        />
        <div className={settingsListRowClass}>
          <div className="grid gap-0.5">
            <div className="text-[13px] text-[color:var(--text)]">Steering mode</div>
            <div className="text-[12px] text-[color:var(--muted)]">
              Advanced Pi queue-drain behavior after steering messages are already queued.
            </div>
          </div>
          <SegmentedToggle
            ariaLabel="Pi steering mode"
            value={piSettings.steeringMode}
            options={
              [
                { value: "one-at-a-time", label: "One" },
                { value: "all", label: "All" },
              ] as const
            }
            onChange={(value) => onUpdate("steeringMode", value)}
            size="compact"
          />
        </div>

        <div className={settingsListRowClass}>
          <div className="grid gap-0.5">
            <div className="text-[13px] text-[color:var(--text)]">Follow-up mode</div>
            <div className="text-[12px] text-[color:var(--muted)]">
              Advanced Pi queue-drain behavior after follow-up messages are already queued.
            </div>
          </div>
          <SegmentedToggle
            ariaLabel="Pi follow-up mode"
            value={piSettings.followUpMode}
            options={
              [
                { value: "one-at-a-time", label: "One" },
                { value: "all", label: "All" },
              ] as const
            }
            onChange={(value) => onUpdate("followUpMode", value)}
            size="compact"
          />
        </div>

        <BooleanSettingRow
          title="Auto resize images"
          description="Resize images before sending them to providers for better compatibility."
          value={piSettings.autoResizeImages}
          onToggle={() => toggle("autoResizeImages")}
        />
        <BooleanSettingRow
          title="Block images"
          description="Prevent images from being sent to model providers."
          value={piSettings.blockImages}
          onToggle={() => toggle("blockImages")}
        />
        <BooleanSettingRow
          title="Install telemetry"
          description="Allow Pi's anonymous package update/version ping."
          value={piSettings.enableInstallTelemetry}
          onToggle={() => toggle("enableInstallTelemetry")}
        />
        <div className="grid gap-0.5 px-1 pt-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted-2)]">
            Pi TUI only
          </div>
          <div className="text-[12px] text-[color:var(--muted)]">
            These change Pi terminal UI behavior and do not affect howcode desktop composer
            behavior.
          </div>
        </div>

        <div className={settingsListRowClass}>
          <div className="grid gap-0.5">
            <div className="text-[13px] text-[color:var(--text)]">Double Escape</div>
            <div className="text-[12px] text-[color:var(--muted)]">
              Pi TUI action for double Escape on an empty editor.
            </div>
          </div>
          <SegmentedToggle
            ariaLabel="Pi double Escape action"
            value={piSettings.doubleEscapeAction}
            options={
              [
                { value: "tree", label: "Tree" },
                { value: "fork", label: "Fork" },
                { value: "none", label: "None" },
              ] as const
            }
            onChange={(value) => onUpdate("doubleEscapeAction", value)}
            size="compact"
          />
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <label className="grid gap-1 text-[12px] text-[color:var(--muted)]">
            Image width
            <input
              type="number"
              min={1}
              max={200}
              value={piSettings.imageWidthCells}
              onChange={(event) => onUpdate("imageWidthCells", event.currentTarget.valueAsNumber)}
              className={settingsInputClass}
            />
          </label>
          <label className="grid gap-1 text-[12px] text-[color:var(--muted)]">
            Editor padding
            <input
              type="number"
              min={0}
              max={3}
              value={piSettings.editorPaddingX}
              onChange={(event) => onUpdate("editorPaddingX", event.currentTarget.valueAsNumber)}
              className={settingsInputClass}
            />
          </label>
          <label className="grid gap-1 text-[12px] text-[color:var(--muted)]">
            Autocomplete rows
            <input
              type="number"
              min={3}
              max={20}
              value={piSettings.autocompleteMaxVisible}
              onChange={(event) =>
                onUpdate("autocompleteMaxVisible", event.currentTarget.valueAsNumber)
              }
              className={settingsInputClass}
            />
          </label>
        </div>

        <BooleanSettingRow
          title="Show images"
          description="Render supported image attachments in capable terminals."
          value={piSettings.showImages}
          onToggle={() => toggle("showImages")}
        />
        <BooleanSettingRow
          title="Hide thinking blocks"
          description="Collapse model reasoning blocks in Pi TUI conversation output."
          value={piSettings.hideThinkingBlock}
          onToggle={() => toggle("hideThinkingBlock")}
        />
        <BooleanSettingRow
          title="Hardware cursor"
          description="Show the terminal cursor while Pi still positions it for IME input."
          value={piSettings.showHardwareCursor}
          onToggle={() => toggle("showHardwareCursor")}
        />
        <BooleanSettingRow
          title="Clear on shrink"
          description="Clear empty terminal rows when rendered content shrinks."
          value={piSettings.clearOnShrink}
          onToggle={() => toggle("clearOnShrink")}
        />
        <BooleanSettingRow
          title="Quiet startup"
          description="Reduce startup resource diagnostics in Pi TUI."
          value={piSettings.quietStartup}
          onToggle={() => toggle("quietStartup")}
        />
        <BooleanSettingRow
          title="Condense changelog"
          description="Show a shorter changelog after Pi updates."
          value={piSettings.collapseChangelog}
          onToggle={() => toggle("collapseChangelog")}
        />
      </div>
    </section>
  );
}
