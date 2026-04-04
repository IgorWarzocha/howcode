import { ChevronDown, GitCommitHorizontal } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { ComposerMenu } from "../components/workspace/composer/ComposerMenu";
import type { DesktopAction } from "../desktop/actions";
import type { AppSettings, ComposerModel } from "../desktop/types";
import { useAnimatedPresence } from "../hooks/useAnimatedPresence";
import { useDismissibleLayer } from "../hooks/useDismissibleLayer";
import { cn } from "../utils/cn";

type SettingsViewProps = {
  appSettings: AppSettings;
  availableModels: ComposerModel[];
  currentModel: ComposerModel | null;
  onAction: (action: DesktopAction, payload?: Record<string, unknown>) => void;
};

export function SettingsView({
  appSettings,
  availableModels,
  currentModel,
  onAction,
}: SettingsViewProps) {
  const selectedModel = appSettings.gitCommitMessageModel;
  const [menuOpen, setMenuOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuPresent = useAnimatedPresence(menuOpen);
  const menuId = "settings-git-commit-model-menu";

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  useDismissibleLayer({
    open: menuOpen,
    onDismiss: closeMenu,
    refs: [buttonRef, panelRef],
  });

  const currentValue = selectedModel
    ? `${selectedModel.provider}/${selectedModel.id}`
    : "Use composer model";

  const handleSelect = (id: string) => {
    if (id === "composer-default") {
      onAction("settings.update", { key: "gitCommitMessageModel", reset: true });
      closeMenu();
      return;
    }

    const [provider, ...modelIdParts] = id.split("/");
    onAction("settings.update", {
      key: "gitCommitMessageModel",
      provider,
      modelId: modelIdParts.join("/"),
    });
    closeMenu();
  };

  return (
    <div className="mx-auto grid h-full w-full max-w-[760px] content-start gap-4 px-2 pt-6 pb-6">
      <div className="grid gap-1">
        <h1 className="m-0 text-[18px] font-medium text-[color:var(--text)]">Settings</h1>
        <p className="m-0 text-[13px] text-[color:var(--muted)]">Git commit message model.</p>
      </div>

      <section className="grid gap-2 rounded-[18px] border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] p-3">
        <div className="relative">
          <button
            ref={buttonRef}
            type="button"
            className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] px-3 py-2.5 text-left transition-colors hover:bg-[rgba(255,255,255,0.04)]"
            onClick={() => setMenuOpen((current) => !current)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuId}
          >
            <div className="grid min-w-0 grid-cols-[16px_minmax(0,1fr)] items-center gap-3">
              <GitCommitHorizontal size={16} className="text-[color:var(--muted)]" />
              <div className="min-w-0">
                <div className="truncate text-[13px] text-[color:var(--muted)]">
                  Git commit message model
                </div>
                <div className="truncate text-[14px] text-[color:var(--text)]">{currentValue}</div>
              </div>
            </div>
            <ChevronDown
              size={14}
              className={cn(
                "text-[color:var(--muted)] transition-transform",
                menuOpen && "rotate-180",
              )}
            />
          </button>

          {menuPresent ? (
            <ComposerMenu
              items={[
                {
                  id: "composer-default",
                  label: "Use composer model",
                  description: currentModel
                    ? `${currentModel.provider}/${currentModel.id}`
                    : "No active composer model",
                  selected: !selectedModel,
                },
                ...availableModels.map((model) => ({
                  id: `${model.provider}/${model.id}`,
                  label: `${model.provider}/${model.id}`,
                  selected:
                    selectedModel?.provider === model.provider && selectedModel.id === model.id,
                })),
              ]}
              menuId={menuId}
              panelRef={panelRef}
              onSelect={handleSelect}
              widthClassName="top-[calc(100%+8px)] bottom-auto left-0 w-full max-h-80 overflow-y-auto"
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}
