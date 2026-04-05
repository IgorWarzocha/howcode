import { Check } from "lucide-react";
import type { RefObject } from "react";
import type { ComposerModel, ComposerThinkingLevel } from "../../../desktop/types";
import { menuOptionClass, popoverPanelClass } from "../../../ui/classes";
import { SurfacePanel } from "../../common/SurfacePanel";

type ComposerModelPopoverProps = {
  availableModels: ComposerModel[];
  availableThinkingLevels: ComposerThinkingLevel[];
  currentModel: ComposerModel | null;
  currentThinkingLevel: ComposerThinkingLevel;
  panelRef: RefObject<HTMLDivElement | null>;
  thinkingLevelLabels: Record<ComposerThinkingLevel, string>;
  onSelectModel: (model: ComposerModel) => void;
  onSelectThinkingLevel: (level: ComposerThinkingLevel) => void;
};

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="px-2.5 pt-2 pb-1 text-[11px] font-medium tracking-[0.08em] text-[color:var(--muted)] uppercase">
      {children}
    </div>
  );
}

export function ComposerModelPopover({
  availableModels,
  availableThinkingLevels,
  currentModel,
  currentThinkingLevel,
  panelRef,
  thinkingLevelLabels,
  onSelectModel,
  onSelectThinkingLevel,
}: ComposerModelPopoverProps) {
  return (
    <SurfacePanel
      ref={panelRef}
      id="composer-model-menu"
      role="menu"
      className={`absolute bottom-[calc(100%+8px)] left-0 z-30 grid max-h-96 w-[22rem] overflow-y-auto rounded-2xl border-[color:var(--border-strong)] p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] ${popoverPanelClass}`}
    >
      <SectionLabel>Models</SectionLabel>
      {availableModels.map((availableModel) => {
        const selected =
          currentModel?.provider === availableModel.provider &&
          currentModel.id === availableModel.id;

        return (
          <button
            key={`${availableModel.provider}/${availableModel.id}`}
            type="button"
            role="menuitemradio"
            aria-checked={selected}
            className={`${menuOptionClass} text-[color:var(--text)]`}
            onClick={() => onSelectModel(availableModel)}
          >
            <span className="inline-flex items-center justify-center text-[color:var(--accent)]">
              {selected ? <Check size={14} /> : null}
            </span>
            <span className="min-w-0">
              <span className="block truncate">{availableModel.name}</span>
              <span className="block truncate text-[11px] text-[color:var(--muted)]">
                {availableModel.provider}/{availableModel.id}
              </span>
            </span>
          </button>
        );
      })}

      {availableThinkingLevels.length > 0 ? (
        <>
          <SectionLabel>Reasoning</SectionLabel>
          {availableThinkingLevels.map((level) => {
            const selected = level === currentThinkingLevel;

            return (
              <button
                key={level}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                className={`${menuOptionClass} text-[color:var(--text)]`}
                onClick={() => onSelectThinkingLevel(level)}
              >
                <span className="inline-flex items-center justify-center text-[color:var(--accent)]">
                  {selected ? <Check size={14} /> : null}
                </span>
                <span className="min-w-0 truncate">{thinkingLevelLabels[level]}</span>
              </button>
            );
          })}
        </>
      ) : null}
    </SurfacePanel>
  );
}
