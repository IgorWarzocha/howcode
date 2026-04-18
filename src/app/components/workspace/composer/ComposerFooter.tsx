import { Bot, GitBranch, Terminal } from "lucide-react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type {
  ComposerModel,
  ComposerThinkingLevel,
  ProjectDiffBaseline,
  ProjectGitState,
} from "../../../desktop/types";
import { compactCardClass, compactIconButtonClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import { PiLogoMark } from "../../common/PiLogoMark";
import { ToolbarButton } from "../../common/ToolbarButton";
import { ComposerDiffBaselineSelector } from "./ComposerDiffBaselineSelector";
import { ComposerModelPopover } from "./ComposerModelPopover";
import { getGitOpsEntryButtonClass } from "./git-ops";

type ComposerFooterProps = {
  availableModels: ComposerModel[];
  availableThinkingLevels: ComposerThinkingLevel[];
  composerPanelRef: RefObject<HTMLDivElement | null>;
  diffBaseline: ProjectDiffBaseline;
  model: ComposerModel | null;
  modelButtonRef: RefObject<HTMLButtonElement | null>;
  modelMenuOpen: boolean;
  modelMenuRef: RefObject<HTMLDivElement | null>;
  onOpenGitOps: () => void;
  onOpenTakeoverTerminal: () => void;
  onSelectBaseline: (baseline: ProjectDiffBaseline) => void;
  onSelectModel: (model: ComposerModel) => void;
  onSelectThinkingLevel: (level: ComposerThinkingLevel) => void;
  onSetOpenMenu: Dispatch<SetStateAction<"model" | "picker" | null>>;
  onToggleTerminal: () => void;
  projectGitState: ProjectGitState | null;
  projectId: string;
  terminalVisible: boolean;
  thinkingLevel: ComposerThinkingLevel;
  thinkingLevelLabels: Record<ComposerThinkingLevel, string>;
};

export function ComposerFooter({
  availableModels,
  availableThinkingLevels,
  composerPanelRef,
  diffBaseline,
  model,
  modelButtonRef,
  modelMenuOpen,
  modelMenuRef,
  onOpenGitOps,
  onOpenTakeoverTerminal,
  onSelectBaseline,
  onSelectModel,
  onSelectThinkingLevel,
  onSetOpenMenu,
  onToggleTerminal,
  projectGitState,
  projectId,
  terminalVisible,
  thinkingLevel,
  thinkingLevelLabels,
}: ComposerFooterProps) {
  const gitVisualMode = !projectGitState?.isGitRepo
    ? "not-git"
    : projectGitState.fileCount > 0
      ? "dirty"
      : "clean";

  return (
    <div className="flex items-center gap-1.5 px-4 pt-2 pb-3 text-[color:var(--muted)] max-md:flex-wrap">
      <ToolbarButton
        label="TUI"
        icon={<PiLogoMark className="h-[14px] w-[14px]" />}
        onClick={onOpenTakeoverTerminal}
      />
      <ToolbarButton
        label="Terminal"
        icon={<Terminal size={14} />}
        onClick={onToggleTerminal}
        className={cn(terminalVisible && "bg-[rgba(255,255,255,0.04)] text-[color:var(--text)]")}
      />
      <div className="relative">
        <ToolbarButton
          ref={modelButtonRef}
          label="Agent"
          icon={<Bot size={14} />}
          onClick={() => onSetOpenMenu((current) => (current === "model" ? null : "model"))}
          aria-haspopup="menu"
          aria-expanded={modelMenuOpen}
          aria-controls="composer-model-menu"
        />
        {modelMenuOpen ? (
          <ComposerModelPopover
            availableModels={availableModels}
            availableThinkingLevels={availableThinkingLevels}
            currentModel={model}
            currentThinkingLevel={thinkingLevel}
            panelRef={modelMenuRef}
            thinkingLevelLabels={thinkingLevelLabels}
            onSelectModel={onSelectModel}
            onSelectThinkingLevel={onSelectThinkingLevel}
          />
        ) : null}
      </div>
      <div className="ml-auto flex items-center gap-2 max-md:flex-wrap">
        {projectGitState?.isGitRepo ? (
          <ComposerDiffBaselineSelector
            composerPanelRef={composerPanelRef}
            projectId={projectId}
            projectGitState={projectGitState}
            selectedBaseline={diffBaseline}
            onSelectBaseline={onSelectBaseline}
          />
        ) : null}
        {projectGitState?.isGitRepo ? (
          <div
            className={cn(
              compactCardClass,
              "inline-flex max-w-[12rem] px-2.5 py-1 text-[12px] text-[color:var(--muted)]",
            )}
            title={projectGitState.branch ?? "Detached"}
          >
            <span className="truncate">{projectGitState.branch ?? "Detached"}</span>
          </div>
        ) : null}
        <button
          type="button"
          className={cn(compactIconButtonClass, getGitOpsEntryButtonClass(gitVisualMode))}
          onClick={onOpenGitOps}
          aria-label="Open git ops"
          title="Open git ops"
        >
          <GitBranch size={14} />
        </button>
      </div>
    </div>
  );
}
