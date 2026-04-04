import { Check, GitCommitHorizontal, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import type { DesktopAction } from "../../desktop/actions";
import type { AppSettings, ComposerModel } from "../../desktop/types";
import { modalPanelClass, panelChromeClass } from "../../ui/classes";
import { cn } from "../../utils/cn";
import { TextButton } from "../common/TextButton";

type SettingsPanelProps = {
  appSettings: AppSettings;
  availableModels: ComposerModel[];
  currentModel: ComposerModel | null;
  open: boolean;
  onClose: () => void;
  onAction: (action: DesktopAction, payload?: Record<string, unknown>) => void;
};

export function SettingsPanel({
  appSettings,
  availableModels,
  currentModel,
  open,
  onClose,
  onAction,
}: SettingsPanelProps) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const selectedModel = appSettings.gitCommitMessageModel;

  useEffect(() => {
    if (!open) {
      return;
    }

    lastFocusedElementRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      lastFocusedElementRef.current?.focus();
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(8,10,18,0.52)] px-6 py-8 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <dialog
        open
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          panelChromeClass,
          modalPanelClass,
          "flex w-full max-w-[720px] flex-col overflow-hidden rounded-3xl",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--border)] px-6 py-5">
          <div>
            <div id={titleId} className="text-[18px] font-medium text-[color:var(--text)]">
              Settings
            </div>
            <p className="mt-1 text-[13px] text-[color:var(--muted)]">
              Choose which Pi model should be used for git commit message generation when that flow
              is enabled. Until you pick one, the app falls back to the current composer model.
            </p>
          </div>
          <TextButton
            ref={closeButtonRef}
            className="p-1"
            onClick={onClose}
            aria-label="Close settings dialog"
          >
            <X size={16} />
          </TextButton>
        </div>

        <div className="grid gap-4 px-6 py-5">
          <section className="grid gap-3">
            <div className="flex items-center gap-2 text-[15px] font-medium text-[color:var(--text)]">
              <GitCommitHorizontal size={16} />
              <span>Git commit message model</span>
            </div>

            <button
              type="button"
              className={cn(
                "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                !selectedModel
                  ? "border-[rgba(183,186,245,0.24)] bg-[rgba(183,186,245,0.08)]"
                  : "border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)]",
              )}
              onClick={() =>
                onAction("settings.update", { key: "gitCommitMessageModel", reset: true })
              }
            >
              <div className="min-w-0">
                <div className="truncate text-[14px] text-[color:var(--text)]">
                  Use current composer model
                </div>
                <div className="truncate text-[12px] text-[color:var(--muted)]">
                  {currentModel
                    ? `${currentModel.name} · ${currentModel.provider}/${currentModel.id}`
                    : "No active composer model"}
                </div>
              </div>
              {!selectedModel ? <Check size={16} className="text-[color:var(--accent)]" /> : null}
            </button>

            <div className="grid gap-2">
              {availableModels.map((model) => {
                const isSelected =
                  selectedModel?.provider === model.provider && selectedModel.id === model.id;

                return (
                  <button
                    key={`${model.provider}/${model.id}`}
                    type="button"
                    className={cn(
                      "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                      isSelected
                        ? "border-[rgba(183,186,245,0.24)] bg-[rgba(183,186,245,0.08)]"
                        : "border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)]",
                    )}
                    onClick={() =>
                      onAction("settings.update", {
                        key: "gitCommitMessageModel",
                        provider: model.provider,
                        modelId: model.id,
                      })
                    }
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[14px] text-[color:var(--text)]">
                        {model.name}
                      </div>
                      <div className="truncate text-[12px] text-[color:var(--muted)]">
                        {model.provider}/{model.id}
                      </div>
                    </div>
                    {isSelected ? <Check size={16} className="text-[color:var(--accent)]" /> : null}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </dialog>
    </div>
  );
}
