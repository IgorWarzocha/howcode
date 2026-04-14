import { Check, FolderPlus } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { SectionIntro } from "../../components/common/SectionIntro";
import type { AppSettings } from "../../desktop/types";
import { settingsInputClass, settingsListRowClass, settingsSectionClass } from "../../ui/classes";
import { cn } from "../../utils/cn";

export function SettingsProjectDefaultsSection({
  appSettings,
  preferredProjectLocationDraft,
  savePreferredProjectLocation,
  setPreferredProjectLocationDraft,
  toggleInitializeGitOnProjectCreate,
  togglePiTuiTakeover,
}: {
  appSettings: AppSettings;
  preferredProjectLocationDraft: string;
  savePreferredProjectLocation: () => void;
  setPreferredProjectLocationDraft: Dispatch<SetStateAction<string>>;
  toggleInitializeGitOnProjectCreate: () => void;
  togglePiTuiTakeover: () => void;
}) {
  const preferredProjectLocationMissing = !appSettings.preferredProjectLocation;

  return (
    <section
      data-pulse-active={preferredProjectLocationMissing ? "true" : "false"}
      className={cn(
        settingsSectionClass,
        "motion-surface-pulse motion-sidebar-selection-pulse",
        preferredProjectLocationMissing &&
          "border-[rgba(183,186,245,0.24)] bg-[rgba(183,186,245,0.06)] shadow-[inset_0_0_0_1px_rgba(183,186,245,0.04)]",
      )}
    >
      <SectionIntro
        title="Defaults"
        description="Set project creation defaults and whether conversations should open in Pi TUI by default."
      />

      <div className="grid gap-2">
        <div className="grid gap-1">
          <div className="grid grid-cols-[16px_minmax(0,1fr)] items-center gap-2 text-[13px] text-[color:var(--muted)]">
            <FolderPlus size={14} />
            <span>Default project location</span>
          </div>
          <input
            type="text"
            value={preferredProjectLocationDraft}
            onChange={(event) => setPreferredProjectLocationDraft(event.target.value)}
            onBlur={savePreferredProjectLocation}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                savePreferredProjectLocation();
              }
            }}
            className={settingsInputClass}
            placeholder="Paste an absolute folder path"
            aria-label="Default project location"
          />
        </div>

        <div className={settingsListRowClass}>
          <div className="grid gap-0.5">
            <div className="text-[13px] text-[color:var(--text)]">
              Initialise git for new projects
            </div>
            <div className="text-[12px] text-[color:var(--muted)]">
              Enables diffs for new projects.
            </div>
          </div>
          <button
            type="button"
            className={cn(
              "inline-flex h-5 w-5 items-center justify-center rounded-md border transition-colors",
              appSettings.initializeGitOnProjectCreate
                ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-[#1a1c26]"
                : "border-[color:var(--border)] bg-transparent text-transparent hover:border-[color:var(--border-strong)]",
            )}
            onClick={toggleInitializeGitOnProjectCreate}
            aria-label="Initialise git for new projects"
            aria-pressed={appSettings.initializeGitOnProjectCreate}
          >
            <Check size={13} />
          </button>
        </div>

        <div className={settingsListRowClass}>
          <div className="grid gap-0.5">
            <div className="text-[13px] text-[color:var(--text)]">Open conversations in Pi TUI</div>
            <div className="text-[12px] text-[color:var(--muted)]">
              Uses Pi takeover by default until a conversation is overridden for this app session.
            </div>
          </div>
          <button
            type="button"
            className={cn(
              "inline-flex h-5 w-5 items-center justify-center rounded-md border transition-colors",
              appSettings.piTuiTakeover
                ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-[#1a1c26]"
                : "border-[color:var(--border)] bg-transparent text-transparent hover:border-[color:var(--border-strong)]",
            )}
            onClick={togglePiTuiTakeover}
            aria-label="Open conversations in Pi TUI"
            aria-pressed={appSettings.piTuiTakeover}
          >
            <Check size={13} />
          </button>
        </div>
      </div>
    </section>
  );
}
