import { AudioLines, Check, FileAudio, Mic, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DesktopActionInvoker } from "../../../desktop/types";
import { getFeatureStatusButtonClass } from "../../../features/feature-status";
import { useAnimatedPresence } from "../../../hooks/useAnimatedPresence";
import { useDismissibleLayer } from "../../../hooks/useDismissibleLayer";
import { compactCardClass, compactIconButtonClass, iconButtonClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import { TextButton } from "../../common/TextButton";

type ComposerDictationControlsProps = {
  dictationActive: boolean;
  dictationMissingModel: boolean;
  dictationSupported: boolean;
  dictationTranscribing: boolean;
  onAction: DesktopActionInvoker;
  onOpenSettingsView: () => void;
  showDictationButton: boolean;
  toggleDictation: () => Promise<"started" | "stopped" | "setup-required" | "unavailable">;
};

export function ComposerDictationControls({
  dictationActive,
  dictationMissingModel,
  dictationSupported,
  dictationTranscribing,
  onAction,
  onOpenSettingsView,
  showDictationButton,
  toggleDictation,
}: ComposerDictationControlsProps) {
  const [dictationPromptOpen, setDictationPromptOpen] = useState(false);
  const dictationButtonRef = useRef<HTMLButtonElement>(null);
  const dictationPromptRef = useRef<HTMLDivElement>(null);
  const dictationPromptPresent = useAnimatedPresence(dictationPromptOpen);

  useDismissibleLayer({
    open: dictationPromptOpen,
    onDismiss: () => setDictationPromptOpen(false),
    refs: [dictationButtonRef, dictationPromptRef],
  });

  useEffect(() => {
    if (!showDictationButton || !dictationMissingModel) {
      setDictationPromptOpen(false);
    }
  }, [dictationMissingModel, showDictationButton]);

  return showDictationButton ? (
    <div className="relative">
      {dictationPromptPresent ? (
        <div
          ref={dictationPromptRef}
          data-open={dictationPromptOpen ? "true" : "false"}
          className={cn(
            compactCardClass,
            "absolute right-[calc(100%+8px)] top-1/2 z-20 inline-flex items-center gap-1.5 whitespace-nowrap -translate-y-1/2 rounded-full px-2 py-1 text-[10.5px] shadow-[0_18px_40px_rgba(0,0,0,0.28)] transition-[opacity,transform] duration-180 ease-out",
            dictationPromptOpen
              ? "translate-x-0 opacity-100"
              : "pointer-events-none translate-x-2 opacity-0",
          )}
        >
          <span className="pr-1 text-[10.5px] text-[color:var(--text)] whitespace-nowrap">
            No speech-to-text model detected. Install?
          </span>
          <button
            type="button"
            className={cn(
              compactIconButtonClass,
              "h-6 w-6 rounded-full bg-[color:var(--accent)] text-[#1a1c26] hover:bg-[color:var(--accent)] hover:text-[#1a1c26]",
            )}
            onClick={() => {
              setDictationPromptOpen(false);
              onOpenSettingsView();
            }}
            aria-label="Open app settings to install speech-to-text"
            title="Open app settings"
          >
            <Check size={12} />
          </button>
          <button
            type="button"
            className={cn(compactIconButtonClass, "h-6 w-6 rounded-full")}
            onClick={() => setDictationPromptOpen(false)}
            aria-label="Dismiss dictation setup prompt"
            title="Dismiss"
          >
            <X size={12} />
          </button>
          <TextButton
            className="rounded-full border border-[rgba(255,110,110,0.22)] px-2 py-0.5 text-[10px] leading-4 whitespace-nowrap text-[#ffbcbc] hover:border-[rgba(255,110,110,0.34)] hover:bg-[rgba(255,110,110,0.08)] hover:text-[#ffd2d2]"
            onClick={() => {
              setDictationPromptOpen(false);
              void onAction("settings.update", {
                key: "showDictationButton",
                value: false,
              });
            }}
          >
            Hide permanently
          </TextButton>
        </div>
      ) : null}
      <button
        ref={dictationButtonRef}
        type="button"
        onClick={async () => {
          dictationButtonRef.current?.blur();
          const result = await toggleDictation();
          setDictationPromptOpen(result === "setup-required");
        }}
        className={cn(
          iconButtonClass,
          getFeatureStatusButtonClass("feature:composer.dictate"),
          dictationActive &&
            "border-[rgba(255,110,110,0.3)] bg-[rgba(255,94,94,0.12)] text-[#ffd1d1]",
          dictationTranscribing &&
            "border-[rgba(183,186,245,0.3)] bg-[rgba(183,186,245,0.12)] text-[color:var(--text)]",
          dictationPromptOpen &&
            "border-[rgba(183,186,245,0.24)] bg-[rgba(183,186,245,0.08)] text-[color:var(--text)]",
        )}
        aria-label={
          dictationActive
            ? "Stop dictation"
            : dictationTranscribing
              ? "Transcribing dictation"
              : "Dictate"
        }
        aria-pressed={dictationActive || dictationTranscribing || dictationPromptOpen}
        title={
          dictationActive
            ? "Stop dictation"
            : dictationTranscribing
              ? "Transcribing dictation"
              : dictationSupported
                ? "Dictate"
                : dictationMissingModel
                  ? "Install speech-to-text model"
                  : "Dictation unavailable in this runtime"
        }
      >
        {dictationActive ? (
          <AudioLines size={15} />
        ) : dictationTranscribing ? (
          <FileAudio size={15} />
        ) : (
          <Mic size={15} />
        )}
      </button>
    </div>
  ) : null;
}
