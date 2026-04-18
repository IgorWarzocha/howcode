import { Check, Download, Mic, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { ActivitySpinner } from "../../components/common/ActivitySpinner";
import type { DictationModelId } from "../../desktop/types";
import { SectionIntro } from "../../components/common/SectionIntro";
import type { AppSettings, DictationModelSummary, DictationState } from "../../desktop/types";
import { inlineCodeClass, settingsListRowClass, settingsSectionClass } from "../../ui/classes";
import { cn } from "../../utils/cn";

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

function ModelActionButton({
  disabled = false,
  primary = false,
  onClick,
  label,
  icon,
}: {
  disabled?: boolean;
  primary?: boolean;
  onClick: () => void;
  label: string;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-7 items-center gap-1 rounded-full border px-2.5 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        primary
          ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-[#1a1c26]"
          : "border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] text-[color:var(--muted)] hover:text-[color:var(--text)]",
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function DictationModelRow({
  activeModelId,
  model,
  pendingAction,
  anyPending,
  onDelete,
  onDownload,
  onUse,
}: {
  activeModelId: DictationModelId | null;
  model: DictationModelSummary;
  pendingAction: "download" | "switch" | "delete" | null;
  anyPending: boolean;
  onDelete: () => void;
  onDownload: () => void;
  onUse: () => void;
}) {
  const isSwitchTarget = activeModelId !== null && activeModelId !== model.id;
  const downloadLabel = isSwitchTarget ? "Download & use" : "Download";

  return (
    <div className={settingsListRowClass}>
      <div className="grid gap-0.5">
        <div className="flex items-center gap-2 text-[13px] text-[color:var(--text)]">
          <span>{model.name}</span>
          <span className="rounded-full border border-[color:var(--border)] px-2 py-0.5 text-[10.5px] text-[color:var(--muted)]">
            {model.downloadSizeLabel}
          </span>
          {model.selected ? (
            <span className="rounded-full border border-[rgba(183,186,245,0.24)] bg-[rgba(183,186,245,0.08)] px-2 py-0.5 text-[10.5px] text-[color:var(--text)]">
              Selected
            </span>
          ) : null}
        </div>
        <div className="text-[12px] text-[color:var(--muted)]">{model.description}</div>
      </div>

      <div className="flex items-center gap-2">
        {model.installed ? (
          <>
            {model.selected ? (
              <div className="inline-flex min-h-7 items-center gap-1 rounded-full border border-[rgba(183,186,245,0.24)] bg-[rgba(183,186,245,0.08)] px-2.5 text-[11px] text-[color:var(--text)]">
                <Check size={11} />
                <span>In use</span>
              </div>
            ) : (
              <ModelActionButton
                disabled={anyPending}
                label={pendingAction === "switch" ? "Switching…" : "Use"}
                icon={
                  pendingAction === "switch" ? (
                    <ActivitySpinner className="h-3 w-3 text-current" />
                  ) : (
                    <Check size={11} />
                  )
                }
                onClick={onUse}
              />
            )}
            <ModelActionButton
              disabled={anyPending}
              label={pendingAction === "delete" ? "Deleting…" : "Delete"}
              icon={
                pendingAction === "delete" ? (
                  <ActivitySpinner className="h-3 w-3 text-current" />
                ) : (
                  <Trash2 size={11} />
                )
              }
              onClick={onDelete}
            />
          </>
        ) : (
          <ModelActionButton
            primary
            disabled={anyPending}
            label={pendingAction === "download" ? "Downloading…" : downloadLabel}
            icon={
              pendingAction === "download" ? (
                <ActivitySpinner className="h-3 w-3 text-current" />
              ) : (
                <Download size={11} />
              )
            }
            onClick={onDownload}
          />
        )}
      </div>
    </div>
  );
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
  selectDictationModel,
  setShowDictationButton,
}: {
  appSettings: AppSettings;
  deleteDictationModel: (modelId: DictationModelId) => void;
  dictationDownloadLogLines: string[];
  dictationInstallError: string | null;
  dictationPendingAction: {
    modelId: DictationModelId;
    kind: "download" | "switch" | "delete";
  } | null;
  dictationModels: DictationModelSummary[];
  dictationState: DictationState | null;
  installDictationModel: (modelId: DictationModelId) => void;
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
          <DictationModelRow
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
