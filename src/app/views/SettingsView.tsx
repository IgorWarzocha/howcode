import { ChevronDown, GitCommitHorizontal } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { ComposerMenu } from "../components/workspace/composer/ComposerMenu";
import type { DesktopAction } from "../desktop/actions";
import type { AppSettings, ComposerModel, DesktopActionResult } from "../desktop/types";
import { useAnimatedPresence } from "../hooks/useAnimatedPresence";
import { useDismissibleLayer } from "../hooks/useDismissibleLayer";
import {
  primaryButtonClass,
  settingsInputClass,
  settingsListRowClass,
  settingsSectionClass,
  settingsSelectButtonClass,
} from "../ui/classes";
import { cn } from "../utils/cn";

type SettingsViewProps = {
  appSettings: AppSettings;
  availableModels: ComposerModel[];
  currentModel: ComposerModel | null;
  onAction: (
    action: DesktopAction,
    payload?: Record<string, unknown>,
  ) => Promise<DesktopActionResult | null>;
};

export function SettingsView({
  appSettings,
  availableModels,
  currentModel,
  onAction,
}: SettingsViewProps) {
  const selectedModel = appSettings.gitCommitMessageModel;
  const favoriteFolders = appSettings.favoriteFolders;
  const [menuOpen, setMenuOpen] = useState(false);
  const [favoriteFolderDraft, setFavoriteFolderDraft] = useState("");
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

  const updateFavoriteFolders = (nextFavoriteFolders: string[]) => {
    onAction("settings.update", {
      key: "favoriteFolders",
      folders: nextFavoriteFolders,
    });
  };

  const addFavoriteFolder = () => {
    const nextFavoriteFolder = favoriteFolderDraft.trim();
    if (!nextFavoriteFolder) {
      return;
    }

    updateFavoriteFolders([...favoriteFolders, nextFavoriteFolder]);
    setFavoriteFolderDraft("");
  };

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
        <p className="m-0 text-[13px] text-[color:var(--muted)]">
          Git commit model and favorite folders.
        </p>
      </div>

      <section className={cn(settingsSectionClass, "gap-2")}>
        <div className="relative">
          <button
            ref={buttonRef}
            type="button"
            className={settingsSelectButtonClass}
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

      <section className={settingsSectionClass}>
        <div className="grid gap-1">
          <h2 className="m-0 text-[15px] font-medium text-[color:var(--text)]">Favorite folders</h2>
          <p className="m-0 text-[13px] text-[color:var(--muted)]">
            The attachment picker always shows Home plus the favorite folders you add here.
          </p>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={favoriteFolderDraft}
            onChange={(event) => setFavoriteFolderDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addFavoriteFolder();
              }
            }}
            className={settingsInputClass}
            placeholder="Paste an absolute folder path"
            aria-label="Favorite folder path"
          />
          <button
            type="button"
            className={cn(
              primaryButtonClass,
              "px-3 disabled:cursor-not-allowed disabled:opacity-45",
            )}
            onClick={addFavoriteFolder}
            disabled={favoriteFolderDraft.trim().length === 0}
          >
            Add
          </button>
        </div>

        <div className="grid gap-2">
          {favoriteFolders.length > 0 ? (
            favoriteFolders.map((favoriteFolder) => (
              <div key={favoriteFolder} className={settingsListRowClass}>
                <div
                  className="truncate text-[13px] text-[color:var(--text)]"
                  title={favoriteFolder}
                >
                  {favoriteFolder}
                </div>
                <button
                  type="button"
                  className="text-[12px] text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)]"
                  onClick={() =>
                    updateFavoriteFolders(
                      favoriteFolders.filter((currentFolder) => currentFolder !== favoriteFolder),
                    )
                  }
                >
                  Remove
                </button>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-[color:var(--border)] px-3 py-4 text-[12px] text-[color:var(--muted)]">
              No favorite folders yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
