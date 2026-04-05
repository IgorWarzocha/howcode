import { type RefObject, useEffect, useMemo, useState } from "react";
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

type MenuOption = {
  id: string;
  label: string;
  description?: string;
  selected: boolean;
  onSelect: () => void;
};

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

function MenuList({ items }: { items: MenuOption[] }) {
  return (
    <div className="-mx-1.5 -mt-1.5 max-h-72 overflow-y-auto pr-0">
      <div className="grid pl-1 pt-1.5 pr-0 pb-2.5">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            role="menuitemradio"
            aria-checked={item.selected}
            className={cn(
              menuOptionClass,
              "mr-1 grid-cols-[minmax(0,1fr)] text-[color:var(--text)]",
              item.selected && "bg-[rgba(255,255,255,0.06)]",
            )}
            onClick={item.onSelect}
          >
            <span className="min-w-0">
              <span className="block truncate">{item.label}</span>
              {item.description ? (
                <span className="block truncate text-[11px] text-[color:var(--muted)]">
                  {item.description}
                </span>
              ) : null}
            </span>
          </button>
        ))}
      </div>
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

  const openMenuItems = useMemo<MenuOption[]>(() => {
    if (openMenu === "provider") {
      return providers.map((provider) => ({
        id: provider.provider,
        label: provider.provider,
        selected: provider.provider === selectedProvider,
        onSelect: () => {
          setSelectedProvider(provider.provider);
          setOpenMenu(null);
        },
      }));
    }

    if (openMenu === "model") {
      return modelsForProvider.map((availableModel) => ({
        id: `${availableModel.provider}/${availableModel.id}`,
        label: availableModel.name,
        selected:
          currentModel?.provider === availableModel.provider &&
          currentModel.id === availableModel.id,
        onSelect: () => {
          onSelectModel(availableModel);
          setOpenMenu(null);
        },
      }));
    }

    if (openMenu === "thinking") {
      return availableThinkingLevels.map((level) => ({
        id: level,
        label: thinkingLevelLabels[level],
        selected: level === currentThinkingLevel,
        onSelect: () => {
          onSelectThinkingLevel(level);
          setOpenMenu(null);
        },
      }));
    }

    return [];
  }, [
    availableThinkingLevels,
    currentModel?.id,
    currentModel?.provider,
    currentThinkingLevel,
    modelsForProvider,
    onSelectModel,
    onSelectThinkingLevel,
    openMenu,
    providers,
    selectedProvider,
    thinkingLevelLabels,
  ]);

  return (
    <SurfacePanel
      ref={panelRef}
      id="composer-model-menu"
      role="menu"
      className={`absolute bottom-[calc(100%+8px)] left-0 z-[60] grid w-48 overflow-hidden rounded-2xl border-[color:var(--border-strong)] p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] ${popoverPanelClass}`}
    >
      {openMenuItems.length > 0 ? (
        <>
          <MenuList items={openMenuItems} />
          <div className="mx-2 mb-1 h-px bg-[rgba(169,178,215,0.08)]" />
        </>
      ) : null}

      <div className="relative min-w-0">
        <TriggerButton
          label="Provider"
          value={selectedProvider || "Choose provider"}
          active={openMenu === "provider"}
          onClick={() => setOpenMenu((current) => (current === "provider" ? null : "provider"))}
        />
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
      </div>

      <div className="relative min-w-0">
        <TriggerButton
          label="Reasoning"
          value={thinkingLevelLabels[currentThinkingLevel]}
          active={openMenu === "thinking"}
          onClick={() => setOpenMenu((current) => (current === "thinking" ? null : "thinking"))}
        />
      </div>
    </SurfacePanel>
  );
}
