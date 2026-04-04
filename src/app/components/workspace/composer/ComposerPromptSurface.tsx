import { ChevronDown, GitBranch, Mic, Plus, Send, SquareTerminal, Terminal } from "lucide-react";
import { getFeatureStatusButtonClass } from "../../../features/feature-status";
import { compactIconButtonClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import { FeatureStatusBadge } from "../../common/FeatureStatusBadge";
import { PiLogoMark } from "../../common/PiLogoMark";
import { ToolbarButton } from "../../common/ToolbarButton";
import type { ComposerProps } from "../Composer";
import { AttachmentChips } from "./AttachmentChips";
import { ComposerMenu } from "./ComposerMenu";
import { formatGitCount, getGitOpsEntryButtonClass } from "./git-ops";
import { useComposerController } from "./useComposerController";

type ComposerPromptSurfaceProps = ComposerProps & { onOpenGitOps: () => void };

export function ComposerPromptSurface({
  activeView,
  hostLabel,
  model,
  availableModels,
  thinkingLevel,
  availableThinkingLevels,
  projectId,
  projectGitState,
  sessionPath,
  onOpenTakeoverTerminal,
  onToggleTerminal,
  onPickAttachments,
  onAction,
  terminalVisible,
  onOpenGitOps,
}: ComposerPromptSurfaceProps) {
  const gitVisualMode = !projectGitState?.isGitRepo
    ? "not-git"
    : projectGitState.fileCount > 0
      ? "dirty"
      : "clean";
  const {
    attachments,
    canSend,
    clearError,
    draft,
    errorMessage,
    modelButtonRef,
    modelLabel,
    modelMenuOpen,
    modelMenuRef,
    pickAttachments,
    removeAttachment,
    runComposerAction,
    send,
    setDraft,
    setOpenMenu,
    thinkingButtonRef,
    thinkingLevelLabels,
    thinkingMenuOpen,
    thinkingMenuRef,
  } = useComposerController({
    model,
    projectId,
    sessionPath,
    onAction,
    onPickAttachments,
  });

  const modelMenuId = "composer-model-menu";
  const thinkingMenuId = "composer-thinking-menu";

  return (
    <>
      <AttachmentChips attachments={attachments} onRemove={removeAttachment} />
      <textarea
        className="min-h-24 w-full resize-none bg-transparent px-4 pt-4 pb-2 text-[14px] leading-[1.45] text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted-2)]"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onInput={() => {
          if (errorMessage) {
            clearError();
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void send();
          }
        }}
        aria-label="Prompt composer"
        placeholder={
          activeView === "thread"
            ? "Ask for follow-up changes"
            : "Ask Pi anything, @ to add files, / for commands, $ for skills"
        }
      />
      <div className="flex items-center justify-between gap-2 px-4 pb-3 max-md:flex-wrap">
        <div className="flex items-center gap-1.5 max-md:flex-wrap">
          <ToolbarButton
            label="Add files and more"
            icon={<Plus size={16} />}
            onClick={pickAttachments}
          />
          <div className="relative">
            <ToolbarButton
              ref={modelButtonRef}
              label={modelLabel}
              icon={<ChevronDown size={14} />}
              onClick={() => setOpenMenu((current) => (current === "model" ? null : "model"))}
              trailing
              aria-haspopup="menu"
              aria-expanded={modelMenuOpen}
              aria-controls={modelMenuId}
            />
            {modelMenuOpen ? (
              <ComposerMenu
                items={availableModels.map((availableModel) => ({
                  id: `${availableModel.provider}/${availableModel.id}`,
                  label: availableModel.name,
                  description: `${availableModel.provider}/${availableModel.id}`,
                  selected:
                    model?.provider === availableModel.provider && model.id === availableModel.id,
                }))}
                menuId={modelMenuId}
                panelRef={modelMenuRef}
                onSelect={(value) => {
                  const [provider, ...modelIdParts] = value.split("/");
                  void runComposerAction("composer.model", {
                    provider,
                    modelId: modelIdParts.join("/"),
                    projectId,
                    sessionPath,
                  });
                }}
                widthClassName="max-h-72 w-72 overflow-y-auto"
              />
            ) : null}
          </div>
          <div className="relative">
            <ToolbarButton
              ref={thinkingButtonRef}
              label={thinkingLevelLabels[thinkingLevel]}
              icon={<ChevronDown size={14} />}
              onClick={() => setOpenMenu((current) => (current === "thinking" ? null : "thinking"))}
              trailing
              aria-haspopup="menu"
              aria-expanded={thinkingMenuOpen}
              aria-controls={thinkingMenuId}
            />
            {thinkingMenuOpen ? (
              <ComposerMenu
                items={availableThinkingLevels.map((level) => ({
                  id: level,
                  label: thinkingLevelLabels[level],
                  selected: level === thinkingLevel,
                }))}
                menuId={thinkingMenuId}
                panelRef={thinkingMenuRef}
                onSelect={(level) => {
                  void runComposerAction("composer.thinking", {
                    level,
                    projectId,
                    sessionPath,
                  });
                }}
                widthClassName="w-48"
              />
            ) : null}
          </div>
          <ToolbarButton
            label={
              <span className="inline-flex items-center gap-2">
                <span>Dictate</span>
                <FeatureStatusBadge statusId="feature:composer.dictate" />
              </span>
            }
            icon={<Mic size={15} />}
            onClick={() => onAction("composer.dictate")}
            className={getFeatureStatusButtonClass("feature:composer.dictate")}
          />
        </div>

        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(146,153,184,0.46)] text-[color:var(--workspace)] disabled:cursor-not-allowed disabled:opacity-45"
          onClick={() => void send()}
          disabled={!canSend}
          aria-label="Send"
        >
          <Send size={16} />
        </button>
      </div>

      {errorMessage ? (
        <output className="px-4 pb-2 text-[12px] text-[#f2a7a7]" aria-live="polite">
          {errorMessage}
        </output>
      ) : null}

      <div className="h-px bg-[rgba(169,178,215,0.07)]" />

      <div className="flex items-center gap-1.5 px-4 pt-2 pb-3 text-[color:var(--muted)] max-md:flex-wrap">
        {sessionPath ? (
          <ToolbarButton
            label="TUI"
            icon={<PiLogoMark className="h-[14px] w-[14px]" />}
            onClick={onOpenTakeoverTerminal}
          />
        ) : null}
        <ToolbarButton
          label={
            <span className="inline-flex items-center gap-2">
              <span>Terminal</span>
              <FeatureStatusBadge statusId="feature:composer.terminal-toggle" />
            </span>
          }
          icon={<Terminal size={14} />}
          onClick={onToggleTerminal}
          className={cn(
            getFeatureStatusButtonClass("feature:composer.terminal-toggle"),
            terminalVisible && "bg-[rgba(255,255,255,0.04)] text-[color:var(--text)]",
          )}
        />
        <ToolbarButton
          label={
            <span className="inline-flex items-center gap-2">
              <span>{hostLabel}</span>
              <FeatureStatusBadge statusId="feature:composer.host" />
            </span>
          }
          icon={<SquareTerminal size={14} />}
          onClick={() => onAction("composer.host")}
          trailing
          className={getFeatureStatusButtonClass("feature:composer.host")}
        />
        <div className="ml-auto flex items-center gap-2">
          <FeatureStatusBadge statusId="feature:composer.git-ops" />
          <div className="flex items-center gap-2 text-[12px]">
            <span className="text-[color:var(--muted)]">
              {formatGitCount(projectGitState?.fileCount ?? 0)} files
            </span>
            <span
              className={
                (projectGitState?.insertions ?? 0) > 0
                  ? "text-[#7ee0bb]"
                  : "text-[color:var(--muted)]"
              }
            >
              +{formatGitCount(projectGitState?.insertions ?? 0)}
            </span>
            <span
              className={
                (projectGitState?.deletions ?? 0) > 0
                  ? "text-[#ff9c9c]"
                  : "text-[color:var(--muted)]"
              }
            >
              -{formatGitCount(projectGitState?.deletions ?? 0)}
            </span>
          </div>
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
    </>
  );
}
