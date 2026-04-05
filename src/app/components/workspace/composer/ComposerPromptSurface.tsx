import { Bot, GitBranch, Mic, Plus, Send, Terminal } from "lucide-react";
import { getFeatureStatusButtonClass } from "../../../features/feature-status";
import { compactIconButtonClass, iconButtonClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import { FeatureStatusBadge } from "../../common/FeatureStatusBadge";
import { PiLogoMark } from "../../common/PiLogoMark";
import { ToolbarButton } from "../../common/ToolbarButton";
import type { ComposerProps } from "../Composer";
import { AttachmentChips } from "./AttachmentChips";
import { ComposerModelPopover } from "./ComposerModelPopover";
import { formatGitCount, getGitOpsEntryButtonClass } from "./git-ops";
import { useComposerController } from "./useComposerController";

type ComposerPromptSurfaceProps = ComposerProps & { onOpenGitOps: () => void };

export function ComposerPromptSurface({
  activeView,
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
    modelMenuOpen,
    modelMenuRef,
    pickAttachments,
    removeAttachment,
    runComposerAction,
    send,
    setDraft,
    setOpenMenu,
    thinkingLevelLabels,
  } = useComposerController({
    model,
    projectId,
    sessionPath,
    onAction,
    onPickAttachments,
  });

  return (
    <div className="grid min-h-[189px] gap-0">
      {/* Keep this outer min-height in sync with ComposerGitOpsSurface so both composer modes
          swap without vertical jump. */}
      <div className="relative min-h-24">
        {/* The prompt surface intentionally uses one shared top block: +, attachments, placeholder,
            textarea, and dictate/send all live here so we match git-ops height without adding a
            separate control row above or below the prompt. */}
        <button
          type="button"
          className={cn(compactIconButtonClass, "absolute top-3 left-4 z-10")}
          onClick={pickAttachments}
          aria-label="Add attachment"
          title="Add attachment"
        >
          <Plus size={16} />
        </button>
        {attachments.length > 0 ? (
          <div className="pt-7">
            <AttachmentChips attachments={attachments} onRemove={removeAttachment} />
          </div>
        ) : null}
        <textarea
          className={cn(
            "min-h-24 w-full resize-none bg-transparent px-4 pr-24 pb-2 text-[14px] leading-[1.45] text-[color:var(--text)] outline-none",
            attachments.length > 0 ? "pt-2" : "pt-10",
          )}
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
          placeholder=""
        />
        {draft.length === 0 ? (
          <div className="pointer-events-none absolute right-24 bottom-4 left-4 text-[14px] leading-[1.45] text-[color:var(--muted-2)]">
            {activeView === "thread"
              ? "Ask for follow-up changes"
              : "Ask Pi anything, @ to add files, / for commands, $ for skills"}
          </div>
        ) : null}
        <div className="absolute right-4 bottom-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onAction("composer.dictate")}
            className={cn(iconButtonClass, getFeatureStatusButtonClass("feature:composer.dictate"))}
            aria-label="Dictate"
            title="Dictate"
          >
            <Mic size={15} />
          </button>
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
      </div>

      {errorMessage ? (
        <output className="px-4 pb-2 text-[12px] text-[#f2a7a7]" aria-live="polite">
          {errorMessage}
        </output>
      ) : null}

      <div className="h-px bg-[rgba(169,178,215,0.07)]" />

      {/* Bottom toolbar should remain structurally aligned with the git-ops footer row. */}
      <div className="flex items-center gap-1.5 px-4 pt-2 pb-3 text-[color:var(--muted)] max-md:flex-wrap">
        <ToolbarButton
          label="TUI"
          icon={<PiLogoMark className="h-[14px] w-[14px]" />}
          onClick={onOpenTakeoverTerminal}
        />
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
        <div className="relative">
          <ToolbarButton
            ref={modelButtonRef}
            label="Agent"
            icon={<Bot size={14} />}
            onClick={() => setOpenMenu((current) => (current === "model" ? null : "model"))}
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
              onSelectModel={(availableModel) => {
                void runComposerAction("composer.model", {
                  provider: availableModel.provider,
                  modelId: availableModel.id,
                  projectId,
                  sessionPath,
                });
              }}
              onSelectThinkingLevel={(level) => {
                void runComposerAction("composer.thinking", {
                  level,
                  projectId,
                  sessionPath,
                });
              }}
            />
          ) : null}
        </div>
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
    </div>
  );
}
