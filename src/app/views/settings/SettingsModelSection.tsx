import { ChevronDown, FilePenLine, GitCommitHorizontal } from "lucide-react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { ComposerMenu } from "../../components/workspace/composer/ComposerMenu";
import type { ComposerModel, ModelSelection } from "../../desktop/types";
import { settingsSectionClass, settingsSelectButtonClass } from "../../ui/classes";
import { cn } from "../../utils/cn";
import { buildModelMenuItems } from "./helpers";

type SettingsModelSectionProps = {
  availableModels: ComposerModel[];
  currentModel: ComposerModel | null;
  gitCommitButtonRef: RefObject<HTMLButtonElement | null>;
  gitCommitCurrentValue: string;
  gitCommitMenuId: string;
  gitCommitMenuOpen: boolean;
  gitCommitMenuPresent: boolean;
  gitCommitPanelRef: RefObject<HTMLDivElement | null>;
  selectedGitCommitModel: ModelSelection | null;
  selectedSkillCreatorModel: ModelSelection | null;
  selectGitCommitModel: (id: string) => void;
  selectSkillCreatorModel: (id: string) => void;
  setGitCommitMenuOpen: Dispatch<SetStateAction<boolean>>;
  setSkillCreatorMenuOpen: Dispatch<SetStateAction<boolean>>;
  skillCreatorButtonRef: RefObject<HTMLButtonElement | null>;
  skillCreatorCurrentValue: string;
  skillCreatorMenuId: string;
  skillCreatorMenuOpen: boolean;
  skillCreatorMenuPresent: boolean;
  skillCreatorPanelRef: RefObject<HTMLDivElement | null>;
};

export function SettingsModelSection({
  availableModels,
  currentModel,
  gitCommitButtonRef,
  gitCommitCurrentValue,
  gitCommitMenuId,
  gitCommitMenuOpen,
  gitCommitMenuPresent,
  gitCommitPanelRef,
  selectedGitCommitModel,
  selectedSkillCreatorModel,
  selectGitCommitModel,
  selectSkillCreatorModel,
  setGitCommitMenuOpen,
  setSkillCreatorMenuOpen,
  skillCreatorButtonRef,
  skillCreatorCurrentValue,
  skillCreatorMenuId,
  skillCreatorMenuOpen,
  skillCreatorMenuPresent,
  skillCreatorPanelRef,
}: SettingsModelSectionProps) {
  return (
    <section className={cn(settingsSectionClass, "gap-2")}>
      <div className="relative">
        <button
          ref={gitCommitButtonRef}
          type="button"
          className={settingsSelectButtonClass}
          onClick={() => setGitCommitMenuOpen((current) => !current)}
          aria-haspopup="menu"
          aria-expanded={gitCommitMenuOpen}
          aria-controls={gitCommitMenuId}
        >
          <div className="grid min-w-0 grid-cols-[16px_minmax(0,1fr)] items-center gap-3">
            <GitCommitHorizontal size={16} className="text-[color:var(--muted)]" />
            <div className="min-w-0">
              <div className="truncate text-[13px] text-[color:var(--muted)]">
                Git commit message model
              </div>
              <div className="truncate text-[14px] text-[color:var(--text)]">
                {gitCommitCurrentValue}
              </div>
            </div>
          </div>
          <ChevronDown
            size={14}
            className={cn(
              "text-[color:var(--muted)] transition-transform",
              gitCommitMenuOpen && "rotate-180",
            )}
          />
        </button>

        {gitCommitMenuPresent ? (
          <ComposerMenu
            items={buildModelMenuItems(selectedGitCommitModel, currentModel, availableModels)}
            menuId={gitCommitMenuId}
            panelRef={gitCommitPanelRef}
            onSelect={selectGitCommitModel}
            widthClassName="top-[calc(100%+8px)] bottom-auto left-0 w-full max-h-80 overflow-y-auto"
          />
        ) : null}
      </div>

      <div className="relative">
        <button
          ref={skillCreatorButtonRef}
          type="button"
          className={settingsSelectButtonClass}
          onClick={() => setSkillCreatorMenuOpen((current) => !current)}
          aria-haspopup="menu"
          aria-expanded={skillCreatorMenuOpen}
          aria-controls={skillCreatorMenuId}
        >
          <div className="grid min-w-0 grid-cols-[16px_minmax(0,1fr)] items-center gap-3">
            <FilePenLine size={16} className="text-[color:var(--muted)]" />
            <div className="min-w-0">
              <div className="truncate text-[13px] text-[color:var(--muted)]">
                Skill creator model
              </div>
              <div className="truncate text-[14px] text-[color:var(--text)]">
                {skillCreatorCurrentValue}
              </div>
            </div>
          </div>
          <ChevronDown
            size={14}
            className={cn(
              "text-[color:var(--muted)] transition-transform",
              skillCreatorMenuOpen && "rotate-180",
            )}
          />
        </button>

        {skillCreatorMenuPresent ? (
          <ComposerMenu
            items={buildModelMenuItems(selectedSkillCreatorModel, currentModel, availableModels)}
            menuId={skillCreatorMenuId}
            panelRef={skillCreatorPanelRef}
            onSelect={selectSkillCreatorModel}
            widthClassName="top-[calc(100%+8px)] bottom-auto left-0 w-full max-h-80 overflow-y-auto"
          />
        ) : null}
      </div>
    </section>
  );
}
