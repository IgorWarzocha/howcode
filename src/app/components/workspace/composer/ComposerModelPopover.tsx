import { Check } from "lucide-react";
import { type ReactNode, type RefObject, useEffect, useMemo, useState } from "react";
import type { ComposerModel, ComposerThinkingLevel } from "../../../desktop/types";
import { menuOptionClass, popoverPanelClass, toolbarButtonClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";
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

type NestedMenu = "provider" | "model" | "thinking" | null;

function NestedMenuPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <SurfacePanel
      className={cn(
        "absolute bottom-[calc(100%+8px)] left-0 z-40 grid max-h-80 overflow-y-auto rounded-2xl border-[color:var(--border-strong)] p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.28)]",
        popoverPanelClass,
        className,
      )}
    >
      {children}
    </SurfacePanel>
  );
}

function TriggerButton({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        toolbarButtonClass,
        "grid w-full min-w-0 gap-0.5 rounded-xl px-2.5 py-2 text-left hover:bg-[rgba(255,255,255,0.045)]",
        active && "bg-[rgba(255,255,255,0.05)] text-[color:var(--text)]",
      )}
      onClick={onClick}
    >
      <span className="text-[12px] text-[color:var(--muted)]">{label}</span>
      <span className="truncate text-[13px] text-[color:var(--text)]">{value}</span>
    </button>
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
  const providers = useMemo(() => {
    const seen = new Set<string>();

    return availableModels.filter((model) => {
      if (seen.has(model.provider)) {
        return false;
      }

      seen.add(model.provider);
      return true;
    });
  }, [availableModels]);

  const [openMenu, setOpenMenu] = useState<NestedMenu>(null);
  const [selectedProvider, setSelectedProvider] = useState(currentModel?.provider ?? "");

  useEffect(() => {
    if (currentModel?.provider) {
      setSelectedProvider(currentModel.provider);
      return;
    }

    setSelectedProvider(providers[0]?.provider ?? "");
  }, [currentModel?.provider, providers]);

  const modelsForProvider = useMemo(
    () => availableModels.filter((model) => model.provider === selectedProvider),
    [availableModels, selectedProvider],
  );

  const currentModelForSelectedProvider =
    currentModel?.provider === selectedProvider ? currentModel : null;

  return (
    <SurfacePanel
      ref={panelRef}
      id="composer-model-menu"
      role="menu"
      className={`absolute bottom-[calc(100%+8px)] left-0 z-50 grid w-48 gap-1 rounded-2xl border-[color:var(--border-strong)] p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] ${popoverPanelClass}`}
    >
      <div className="relative min-w-0">
        <TriggerButton
          label="Provider"
          value={selectedProvider || "Choose provider"}
          active={openMenu === "provider"}
          onClick={() => setOpenMenu((current) => (current === "provider" ? null : "provider"))}
        />
        {openMenu === "provider" ? (
          <NestedMenuPanel className="w-48">
            {providers.map((provider) => {
              const selected = provider.provider === selectedProvider;

              return (
                <button
                  key={provider.provider}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  className={`${menuOptionClass} text-[color:var(--text)]`}
                  onClick={() => {
                    setSelectedProvider(provider.provider);
                    setOpenMenu(null);
                  }}
                >
                  <span className="inline-flex items-center justify-center text-[color:var(--accent)]">
                    {selected ? <Check size={14} /> : null}
                  </span>
                  <span className="min-w-0 truncate">{provider.provider}</span>
                </button>
              );
            })}
          </NestedMenuPanel>
        ) : null}
      </div>

      <div className="relative min-w-0">
        <TriggerButton
          label="Model"
          value={
            currentModelForSelectedProvider?.name ?? modelsForProvider[0]?.name ?? "Choose model"
          }
          active={openMenu === "model"}
          onClick={() => setOpenMenu((current) => (current === "model" ? null : "model"))}
        />
        {openMenu === "model" ? (
          <NestedMenuPanel className="w-56">
            {modelsForProvider.map((availableModel) => {
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
                  onClick={() => {
                    onSelectModel(availableModel);
                    setOpenMenu(null);
                  }}
                >
                  <span className="inline-flex items-center justify-center text-[color:var(--accent)]">
                    {selected ? <Check size={14} /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate">{availableModel.name}</span>
                    <span className="block truncate text-[11px] text-[color:var(--muted)]">
                      {availableModel.id}
                    </span>
                  </span>
                </button>
              );
            })}
          </NestedMenuPanel>
        ) : null}
      </div>

      <div className="relative min-w-0">
        <TriggerButton
          label="Reasoning"
          value={thinkingLevelLabels[currentThinkingLevel]}
          active={openMenu === "thinking"}
          onClick={() => setOpenMenu((current) => (current === "thinking" ? null : "thinking"))}
        />
        {openMenu === "thinking" ? (
          <NestedMenuPanel className="w-48">
            {availableThinkingLevels.map((level) => {
              const selected = level === currentThinkingLevel;

              return (
                <button
                  key={level}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  className={`${menuOptionClass} text-[color:var(--text)]`}
                  onClick={() => {
                    onSelectThinkingLevel(level);
                    setOpenMenu(null);
                  }}
                >
                  <span className="inline-flex items-center justify-center text-[color:var(--accent)]">
                    {selected ? <Check size={14} /> : null}
                  </span>
                  <span className="min-w-0 truncate">{thinkingLevelLabels[level]}</span>
                </button>
              );
            })}
          </NestedMenuPanel>
        ) : null}
      </div>
    </SurfacePanel>
  );
}
