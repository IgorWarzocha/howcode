import { Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ViewHeader } from "../components/common/ViewHeader";
import { ViewShell } from "../components/common/ViewShell";
import type {
  AppSettings,
  ComposerModel,
  ComposerThinkingLevel,
  DesktopActionInvoker,
  DictationModelId,
  PiSettings,
} from "../desktop/types";
import { settingsSectionClass } from "../ui/classes";
import { cn } from "../utils/cn";
import type { Project } from "../types";
import { useSettingsController } from "./settings/useSettingsController";
import {
  filterSettings,
  groupSettingsByCategory,
  settingsCategories,
} from "./settings/settingsGroups";
import type { SettingsCategoryId } from "./settings/settingsTypes";
import { buildSettingsDescriptors } from "./settings/settingsDescriptors";
import { SettingRow, normalizeManagedDictationModelId } from "./settings/settingsUi";

type SettingsViewProps = {
  appSettings: AppSettings;
  piSettings: PiSettings;
  availableModels: ComposerModel[];
  availableThinkingLevels: ComposerThinkingLevel[];
  currentModel: ComposerModel | null;
  projects: Project[];
  onAction: DesktopActionInvoker;
  onClose: () => void;
};

export function SettingsView({
  appSettings,
  piSettings,
  availableModels,
  availableThinkingLevels,
  currentModel,
  projects,
  onAction,
  onClose,
}: SettingsViewProps) {
  const controller = useSettingsController({ appSettings, projects, onAction });
  const [draftPiSettings, setDraftPiSettings] = useState(piSettings);
  const draftPiSettingsRef = useRef(draftPiSettings);
  const dirtyPiSettingsRef = useRef(new Set<keyof PiSettings>());
  const [filter, setFilter] = useState("");
  const [activeCategory, setActiveCategory] = useState<SettingsCategoryId | null>(null);
  const [openSelectId, setOpenSelectId] = useState<string | null>(null);
  const [dictationModelDraft, setDictationModelDraft] = useState<DictationModelId | null>(null);
  const normalizedFilter = filter.trim().toLowerCase();

  useEffect(() => {
    draftPiSettingsRef.current = draftPiSettings;
  }, [draftPiSettings]);

  useEffect(() => {
    if (dirtyPiSettingsRef.current.size === 0) {
      setDraftPiSettings(piSettings);
    }
  }, [piSettings]);

  const setDraftPiSetting = useCallback(
    <Key extends keyof PiSettings>(key: Key, value: PiSettings[Key]) => {
      dirtyPiSettingsRef.current.add(key);
      setDraftPiSettings((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const flushPiSettings = useCallback(async () => {
    const dirtyKeys = [...dirtyPiSettingsRef.current];
    if (dirtyKeys.length === 0) {
      return;
    }

    dirtyPiSettingsRef.current.clear();
    const snapshot = draftPiSettingsRef.current;
    for (const key of dirtyKeys) {
      await onAction("pi-settings.update", {
        piSettingsKey: key,
        value: snapshot[key],
      });
    }
  }, [onAction]);

  useEffect(() => {
    return () => {
      void flushPiSettings();
    };
  }, [flushPiSettings]);

  const closeSettings = useCallback(() => {
    void flushPiSettings().finally(onClose);
  }, [flushPiSettings, onClose]);

  useEffect(() => {
    if (!openSelectId) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (!target.closest("[data-inline-select-root]")) {
        setOpenSelectId(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpenSelectId(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [openSelectId]);

  const configuredDictationModelId = normalizeManagedDictationModelId(appSettings.dictationModelId);
  useEffect(() => {
    setDictationModelDraft(configuredDictationModelId);
  }, [configuredDictationModelId]);

  const settings = buildSettingsDescriptors({
    appSettings,
    availableModels,
    availableThinkingLevels,
    currentModel,
    controller,
    draftPiSettings,
    setDraftPiSetting,
    openSelectId,
    setOpenSelectId,
    dictationModelDraft,
    setDictationModelDraft,
    configuredDictationModelId,
    onAction,
  });

  const filteredSettings = filterSettings({
    settings,
    normalizedFilter,
    activeCategory,
  });
  const visibleGroups = groupSettingsByCategory({ settings: filteredSettings });

  return (
    <ViewShell
      className="h-full grid-rows-[auto_minmax(0,1fr)] overflow-hidden pb-0"
      maxWidthClassName="max-w-[1120px]"
    >
      <div className="grid items-center gap-4 lg:grid-cols-[220px_minmax(0,1fr)_auto]">
        <ViewHeader title="App settings" className="items-center" />
        <div className="hidden h-10 items-center lg:flex">
          <label className="relative block w-[min(460px,42vw)]">
            <Search
              size={15}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[color:var(--muted)]"
            />
            <input
              type="search"
              value={filter}
              onChange={(event) => setFilter(event.currentTarget.value)}
              className="h-10 w-full min-w-0 flex-1 rounded-xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.055)] px-3 py-2 pl-9 text-[13px] text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted)]"
              placeholder="Search…"
              aria-label="Search settings"
            />
          </label>
        </div>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center self-center rounded-full border border-[color:var(--border)] bg-[rgba(255,255,255,0.03)] text-[color:var(--text)] transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.07)]"
          onClick={closeSettings}
          aria-label="Close app settings"
          data-tooltip="Close app settings"
        >
          <X size={14} />
        </button>
      </div>

      <div className="grid min-h-0 items-start gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="sticky top-0 hidden rounded-[22px] border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] p-2 lg:grid">
          <button
            type="button"
            className={cn(
              "flex h-10 items-center rounded-xl px-3 text-left text-[12px] transition-colors active:scale-[0.96]",
              activeCategory === null && !normalizedFilter
                ? "bg-[rgba(169,178,215,0.14)] text-[color:var(--text)]"
                : "text-[color:var(--muted)] hover:bg-[rgba(169,178,215,0.08)] hover:text-[color:var(--text)]",
            )}
            onClick={() => setActiveCategory(null)}
          >
            All settings
          </button>
          {settingsCategories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={cn(
                "flex h-10 items-center rounded-xl px-3 text-left text-[12px] transition-colors active:scale-[0.96]",
                activeCategory === category.id && !normalizedFilter
                  ? "bg-[rgba(169,178,215,0.14)] text-[color:var(--text)]"
                  : "text-[color:var(--muted)] hover:bg-[rgba(169,178,215,0.08)] hover:text-[color:var(--text)]",
              )}
              onClick={() => setActiveCategory(category.id)}
            >
              {category.label}
            </button>
          ))}
        </nav>

        <div className="grid max-h-full min-h-0 gap-4 overflow-y-auto pr-1 pb-6">
          <label className="relative block lg:hidden">
            <Search
              size={15}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[color:var(--muted)]"
            />
            <input
              type="search"
              value={filter}
              onChange={(event) => setFilter(event.currentTarget.value)}
              className="h-10 w-full min-w-0 flex-1 rounded-xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.055)] px-3 py-2 pl-9 text-[13px] text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted)]"
              placeholder="Search…"
              aria-label="Search settings"
            />
          </label>

          <div className="flex flex-wrap items-center gap-1.5 lg:hidden">
            <button
              type="button"
              className={cn(
                "rounded-full border border-[color:var(--border)] px-3 py-1.5 text-[12px] transition-colors",
                activeCategory === null && "bg-[rgba(169,178,215,0.14)] text-[color:var(--text)]",
              )}
              onClick={() => setActiveCategory(null)}
            >
              All
            </button>
            {settingsCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={cn(
                  "rounded-full border border-[color:var(--border)] px-3 py-1.5 text-[12px] text-[color:var(--muted)] transition-colors",
                  activeCategory === category.id &&
                    "bg-[rgba(169,178,215,0.14)] text-[color:var(--text)]",
                )}
                onClick={() => setActiveCategory(category.id)}
              >
                {category.label}
              </button>
            ))}
          </div>

          {visibleGroups.length > 0 ? (
            visibleGroups.map((group) => (
              <section key={group.id} className={cn(settingsSectionClass, "gap-1 p-2.5")}>
                <div className="flex items-baseline justify-between gap-3 px-1 pb-1">
                  <h2 className="text-[15px] font-semibold text-[color:var(--text)]">
                    {group.label}
                  </h2>
                </div>
                <div className="grid gap-2">
                  {group.settings.map((setting) => (
                    <SettingRow key={setting.id} setting={setting} />
                  ))}
                </div>
              </section>
            ))
          ) : (
            <div className="rounded-[22px] border border-[rgba(169,178,215,0.12)] bg-[rgba(255,255,255,0.025)] p-8 text-center">
              <div className="text-[14px] text-[color:var(--text)]">No matching settings</div>
              <div className="mt-1 text-[12px] text-[color:var(--muted)]">
                Try a broader term like “Pi”, “model”, “folder”, or “voice”.
              </div>
            </div>
          )}
        </div>
      </div>
    </ViewShell>
  );
}
