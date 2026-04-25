import { SectionIntro } from "../../components/common/SectionIntro";
import { primaryButtonClass, settingsSectionClass } from "../../ui/classes";
import { cn } from "../../utils/cn";

export function SettingsProjectImportSection({
  importBusy,
  desktopBridgeAvailable,
  importErrorMessage,
  importStatusMessage,
  importedState,
  onImport,
  onShowFirstLaunchReminderAgain,
}: {
  importBusy: boolean;
  desktopBridgeAvailable: boolean;
  importErrorMessage: string | null;
  importStatusMessage: string | null;
  importedState: boolean | null;
  onImport: () => void;
  onShowFirstLaunchReminderAgain: () => void;
}) {
  return (
    <section className={settingsSectionClass}>
      <SectionIntro
        title="Project UI import"
        description="This scans your current projects for UI information like repo/origin status. New projects are still checked once when you open them for the first time."
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          className={cn(primaryButtonClass, "px-3 disabled:cursor-not-allowed disabled:opacity-45")}
          onClick={onImport}
          disabled={importBusy || !desktopBridgeAvailable}
        >
          {importBusy ? "Importing…" : importedState ? "Run again" : "Import now"}
        </button>
        {importedState === false ? (
          <button
            type="button"
            className="text-[12px] text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)]"
            onClick={onShowFirstLaunchReminderAgain}
          >
            Show first-launch reminder again
          </button>
        ) : null}
      </div>

      {importStatusMessage ? (
        <div className="text-[12px] text-[color:var(--muted)]">{importStatusMessage}</div>
      ) : null}
      {!desktopBridgeAvailable ? (
        <div className="text-[12px] text-[color:var(--muted)]">
          Project sync needs the desktop bridge. Restart the dev server or use{" "}
          <code>bun run dev</code>.
        </div>
      ) : null}
      {importErrorMessage ? (
        <div className="text-[12px] text-[#f2a7a7]">{importErrorMessage}</div>
      ) : null}
    </section>
  );
}
