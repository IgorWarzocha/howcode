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
}: {
  appSettings: AppSettings;
  preferredProjectLocationDraft: string;
  savePreferredProjectLocation: () => void;
  setPreferredProjectLocationDraft: Dispatch<SetStateAction<string>>;
  toggleInitializeGitOnProjectCreate: () => void;
}) {
  return (
    <section className={settingsSectionClass}>
      <SectionIntro
        title="New projects"
        description="Set where new projects are created and whether git should be initialised for diffs."
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
      </div>
    </section>
  );
}
