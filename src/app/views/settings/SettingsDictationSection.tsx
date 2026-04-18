import { Check, Mic } from "lucide-react";
import {
  DEFAULT_DICTATION_MAX_DURATION_SECONDS,
  DICTATION_MAX_DURATION_OPTIONS,
} from "../../../../shared/dictation-settings";
import type { DictationModelId, DictationModelSummary } from "../../desktop/types";
import { SectionIntro } from "../../components/common/SectionIntro";
import type { AppSettings, DictationState } from "../../desktop/types";
import {
  inlineCodeClass,
  settingsInputClass,
  settingsListRowClass,
  settingsSectionClass,
} from "../../ui/classes";
import { cn } from "../../utils/cn";
import { SettingsDictationModelRow } from "./SettingsDictationModelRow";
import type { DictationPendingAction } from "./useSettingsDictationController";

function normalizeManagedDictationModelId(
  modelId: string | null | undefined,
): DictationModelId | null {
  return modelId === "tiny.en" || modelId === "base.en" || modelId === "small.en" ? modelId : null;
}

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
        ? `Using ${dictationState.modelId}. Dictation is ready to use from the composer mic button.`
        : "A local speech-to-text model was detected. Dictation is ready to use.",
    };
  }

  if (dictationState.reason === "missing-model") {
    return {
      title: "No speech-to-text model detected",
      description: "Download one of the curated int8 Whisper models below to enable dictation.",
    };
  }

  return {
    title: "Speech-to-text unavailable",
    description: dictationState.error ?? "The local dictation runtime is currently unavailable.",
  };
}

export function SettingsDictationSection({
  appSettings,
  deleteDictationModel,
  dictationDownloadLogLines,
  dictationInstallError,
  dictationPendingAction,
  dictationModels,
  dictationState,
  installDictationModel,
  setDictationMaxDurationSeconds,
  selectDictationModel,
  setShowDictationButton,
}: {
  appSettings: AppSettings;
  deleteDictationModel: (modelId: DictationModelId) => void;
  dictationDownloadLogLines: string[];
  dictationInstallError: string | null;
  dictationPendingAction: DictationPendingAction | null;
  dictationModels: DictationModelSummary[];
  dictationState: DictationState | null;
  installDictationModel: (modelId: DictationModelId) => void;
  setDictationMaxDurationSeconds: (value: number) => void;
  selectDictationModel: (modelId: DictationModelId) => void;
  setShowDictationButton: (value: boolean) => void;
}) {
  const statusCopy = getDictationStatusCopy(dictationState);
  const activeModelId =
    dictationModels.find((model) => model.selected)?.id ??
    normalizeManagedDictationModelId(dictationState?.modelId) ??
    null;

  return (
    <section className={settingsSectionClass}>
      <SectionIntro
        title="Speech to text"
        description="Download one of the curated sherpa-onnx int8 Whisper models and choose which installed model the composer should use."
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
          {dictationState?.available ? "Ready" : (dictationState?.reason ?? "Pending")}
        </div>
      </div>

      <div className="grid gap-2">
        {dictationModels.map((model) => (
          <SettingsDictationModelRow
            key={model.id}
            activeModelId={activeModelId}
            anyPending={dictationPendingAction !== null}
            model={model}
            pendingAction={
              dictationPendingAction?.modelId === model.id ? dictationPendingAction.kind : null
            }
            onDelete={() => deleteDictationModel(model.id)}
            onDownload={() => installDictationModel(model.id)}
            onUse={() => selectDictationModel(model.id)}
          />
        ))}
      </div>

      {dictationInstallError ? (
        <output className="text-[12px] text-[#f2a7a7]" aria-live="polite">
          {dictationInstallError}
        </output>
      ) : null}

      {dictationDownloadLogLines.length > 0 ? (
        <div className="grid gap-1.5 rounded-xl border border-[color:var(--border)] bg-[rgba(18,20,28,0.78)] px-3 py-2 font-mono text-[11px] text-[color:var(--muted)]">
          <div className="text-[10.5px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
            Temporary download log
          </div>
          <div className="grid gap-1">
            {dictationDownloadLogLines.map((line, index) => (
              <div key={`${index}:${line}`}>{line}</div>
            ))}
          </div>
        </div>
      ) : null}

      <div className={settingsListRowClass}>
        <div className="grid gap-0.5">
          <div className="text-[13px] text-[color:var(--text)]">Max dictation length</div>
          <div className="text-[12px] text-[color:var(--muted)]">
            Longer captures use more memory before transcription. Default is{" "}
            {DEFAULT_DICTATION_MAX_DURATION_SECONDS / 60} minutes.
          </div>
        </div>
        <select
          className={settingsInputClass}
          value={String(appSettings.dictationMaxDurationSeconds)}
          onChange={(event) =>
            setDictationMaxDurationSeconds(Number.parseInt(event.target.value, 10))
          }
          aria-label="Max dictation length"
        >
          {DICTATION_MAX_DURATION_OPTIONS.map((seconds) => (
            <option key={seconds} value={seconds}>
              {seconds < 60 ? `${seconds} seconds` : `${seconds / 60} minutes`}
            </option>
          ))}
        </select>
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
