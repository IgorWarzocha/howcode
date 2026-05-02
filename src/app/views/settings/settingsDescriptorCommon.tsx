import type { AppSettings } from "../../desktop/types";
import { cn } from "../../utils/cn";
import type { SettingDescriptor } from "./settingsTypes";
import { ToggleBox } from "./settingsUi";
import type { SettingsController } from "./settingsDescriptorTypes";

export function buildCommonSettingsDescriptors({
  appSettings,
  controller,
}: {
  appSettings: AppSettings;
  controller: SettingsController;
}): SettingDescriptor[] {
  return [
    {
      id: "common.streaming-behavior",
      category: "pi-runtime",
      title: "Send while Pi is responding",
      description:
        "Desktop composer policy. Steer interrupts, Queue waits for the current turn, Stop aborts without sending.",
      keywords: "queue steer stop streaming responding send composer",
      render: () => (
        <div className="min-w-0 sm:min-w-[13rem]">
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
      category: "pi-runtime",
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
  ];
}
