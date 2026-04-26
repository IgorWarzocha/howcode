import { Bot, GitBranch, Terminal } from "lucide-react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type {
  ComposerContextUsage,
  ComposerModel,
  ComposerThinkingLevel,
  ProjectDiffBaseline,
  ProjectGitState,
} from "../../../desktop/types";
import { compactCardClass, compactIconButtonClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import { PiLogoMark } from "../../common/PiLogoMark";
import { ToolbarButton } from "../../common/ToolbarButton";
import { ComposerContextMeter } from "./ComposerContextMeter";
import { ComposerDiffBaselineSelector } from "./ComposerDiffBaselineSelector";
import { ComposerModelPopover } from "./ComposerModelPopover";
import { getGitOpsEntryButtonClass } from "./git-ops";

type ComposerFooterProps = {
  availableModels: ComposerModel[];
  availableThinkingLevels: ComposerThinkingLevel[];
  composerPanelRef: RefObject<HTMLDivElement | null>;
  diffBaseline: ProjectDiffBaseline;
  model: ComposerModel | null;
  contextUsage: ComposerContextUsage | null;
  compactDisabled: boolean;
  isCompacting: boolean;
  modelButtonRef: RefObject<HTMLButtonElement | null>;
  modelMenuOpen: boolean;
  modelMenuRef: RefObject<HTMLDivElement | null>;
  onOpenGitOps: () => void;
  onOpenTakeoverTerminal: () => void;
  onCompact: () => void;
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
  contextUsage,
  compactDisabled,
  isCompacting,
  modelButtonRef,
  modelMenuOpen,
  modelMenuRef,
  onOpenGitOps,
  onOpenTakeoverTerminal,
  onCompact,
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
      <div className="relative inline-flex h-7 items-center">
        <ToolbarButton
          ref={modelButtonRef}
          label="Agent"
          icon={<Bot size={14} />}
          className="pr-8"
          onClick={() => onSetOpenMenu((current) => (current === "model" ? null : "model"))}
          aria-haspopup="menu"
          aria-expanded={modelMenuOpen}
          aria-controls="composer-model-menu"
        />
        <div className="absolute top-0 right-0">
          <ComposerContextMeter
            contextUsage={contextUsage}
            compactDisabled={compactDisabled}
            isCompacting={isCompacting}
            onCompact={onCompact}
          />
        </div>
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
      <div className="ml-auto flex min-h-7 items-center gap-1.5 max-md:flex-wrap">
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
              "inline-flex h-7 max-w-[12rem] items-center px-2.5 py-0 text-[12px] leading-none text-[color:var(--muted)]",
            )}
            title={projectGitState.branch ?? "Detached"}
          >
            <span className="truncate">{projectGitState.branch ?? "Detached"}</span>
          </div>
        ) : null}
        <button
          type="button"
          className={cn(
            compactIconButtonClass,
            "h-7 w-7",
            getGitOpsEntryButtonClass(gitVisualMode),
          )}
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
