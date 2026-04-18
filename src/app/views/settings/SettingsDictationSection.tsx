import { Check, Mic } from "lucide-react";
import { SectionIntro } from "../../components/common/SectionIntro";
import type { AppSettings, DictationState } from "../../desktop/types";
import { inlineCodeClass, settingsListRowClass, settingsSectionClass } from "../../ui/classes";
import { cn } from "../../utils/cn";

function getDictationStatusCopy(dictationState: DictationState | null) {
  if (!dictationState) {
    return {
      title: "Checking speech-to-text models…",
      description:
        "The app checks for downloaded local models on launch before enabling dictation.",
    };
  }

  if (dictationState.available) {
    return {
      title: "Speech-to-text ready",
      description: dictationState.modelId
        ? `Detected ${dictationState.modelId}. Dictation is ready to use from the composer mic button.`
        : "A local speech-to-text model was detected. Dictation is ready to use.",
    };
  }

  if (dictationState.reason === "missing-model") {
    return {
      title: "No speech-to-text model detected",
      description:
        "The first-run install and model picker flow will live here. For now this section is the destination from the composer prompt.",
    };
  }

  return {
    title: "Speech-to-text unavailable",
    description: dictationState.error ?? "The local dictation runtime is currently unavailable.",
  };
}

export function SettingsDictationSection({
  appSettings,
  dictationState,
  setShowDictationButton,
}: {
  appSettings: AppSettings;
  dictationState: DictationState | null;
  setShowDictationButton: (value: boolean) => void;
}) {
  const statusCopy = getDictationStatusCopy(dictationState);

  return (
    <section className={settingsSectionClass}>
      <SectionIntro
        title="Speech to text"
        description="Local dictation checks for downloaded models on app launch. Model picking and downloading will be added here next."
      />

      <div className={settingsListRowClass}>
        <div className="grid gap-0.5">
          <div className="flex items-center gap-2 text-[13px] text-[color:var(--text)]">
            <Mic size={14} className="text-[color:var(--muted)]" />
            <span>{statusCopy.title}</span>
          </div>
          <div className="text-[12px] text-[color:var(--muted)]">{statusCopy.description}</div>
          {dictationState?.modelDirectory ? (
            <div className="pt-1 text-[11.5px] text-[color:var(--muted)]">
              Looking in <span className={inlineCodeClass}>{dictationState.modelDirectory}</span>
            </div>
          ) : null}
        </div>
        <div className="rounded-full border border-[color:var(--border)] px-2.5 py-1 text-[11.5px] text-[color:var(--muted)]">
          {dictationState?.available ? "Detected" : (dictationState?.reason ?? "Pending")}
        </div>
      </div>

      <div className={settingsListRowClass}>
        <div className="grid gap-0.5">
          <div className="text-[13px] text-[color:var(--text)]">Show composer dictation button</div>
          <div className="text-[12px] text-[color:var(--muted)]">
            If hidden, you can still re-enable it here after dismissing the first-run prompt.
          </div>
        </div>
        <button
          type="button"
          className={cn(
            "inline-flex h-5 w-5 items-center justify-center rounded-md border transition-colors",
            appSettings.showDictationButton
              ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-[#1a1c26]"
              : "border-[color:var(--border)] bg-transparent text-transparent hover:border-[color:var(--border-strong)]",
          )}
          onClick={() => setShowDictationButton(!appSettings.showDictationButton)}
          aria-label="Show composer dictation button"
          aria-pressed={appSettings.showDictationButton}
        >
          <Check size={13} />
        </button>
      </div>
    </section>
  );
}
