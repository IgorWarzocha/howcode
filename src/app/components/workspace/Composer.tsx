import { ChevronDown, Mic, Plus, Send, Settings, SquareTerminal } from "lucide-react";
import type { DesktopAction } from "../../desktop/actions";
import type { ComposerAttachment, ComposerModel, ComposerThinkingLevel } from "../../desktop/types";
import { getFeatureStatusButtonClass } from "../../features/feature-status";
import type { View } from "../../types";
import { FeatureStatusBadge } from "../common/FeatureStatusBadge";
import { SurfacePanel } from "../common/SurfacePanel";
import { ToolbarButton } from "../common/ToolbarButton";
import { AttachmentChips } from "./composer/AttachmentChips";
import { ComposerBanner } from "./composer/ComposerBanner";
import { ComposerMenu } from "./composer/ComposerMenu";
import { useComposerController } from "./composer/useComposerController";

type ComposerProps = {
  activeView: View;
  hostLabel: string;
  profileLabel: string;
  model: ComposerModel | null;
  availableModels: ComposerModel[];
  thinkingLevel: ComposerThinkingLevel;
  availableThinkingLevels: ComposerThinkingLevel[];
  projectId: string;
  sessionPath: string | null;
  onOpenTakeoverTerminal: () => void;
  onPickAttachments: (projectId?: string | null) => Promise<ComposerAttachment[]>;
  onAction: (action: DesktopAction, payload?: Record<string, unknown>) => Promise<void>;
};

export function Composer({
  activeView,
  hostLabel,
  profileLabel,
  model,
  availableModels,
  thinkingLevel,
  availableThinkingLevels,
  projectId,
  sessionPath,
  onOpenTakeoverTerminal,
  onPickAttachments,
  onAction,
}: ComposerProps) {
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
      {activeView === "home" ? <ComposerBanner onAction={onAction} /> : null}

      <SurfacePanel
        className="grid gap-0 overflow-hidden border-[rgba(169,178,215,0.06)] bg-[rgba(39,42,57,0.94)] shadow-none"
        aria-label="Composer panel"
      >
        <AttachmentChips attachments={attachments} onRemove={removeAttachment} />
        <textarea
          className="min-h-[86px] w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-[14px] leading-[1.45] text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted-2)]"
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
        <div className="flex items-center justify-between gap-2 px-3.5 pb-2.5 max-md:flex-wrap">
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
                  widthClassName="max-h-[280px] w-[280px] overflow-y-auto"
                />
              ) : null}
            </div>
            <div className="relative">
              <ToolbarButton
                ref={thinkingButtonRef}
                label={thinkingLevelLabels[thinkingLevel]}
                icon={<ChevronDown size={14} />}
                onClick={() =>
                  setOpenMenu((current) => (current === "thinking" ? null : "thinking"))
                }
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
                  widthClassName="w-[180px]"
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
          <output className="px-3.5 pb-2 text-[12px] text-[#f2a7a7]" aria-live="polite">
            {errorMessage}
          </output>
        ) : null}

        <div className="h-px bg-[rgba(169,178,215,0.07)]" />

        <div className="flex items-center gap-1.5 px-3.5 pt-2 pb-3 text-[color:var(--muted)] max-md:flex-wrap">
          {sessionPath ? (
            <ToolbarButton
              label={
                <span className="inline-flex items-center gap-2">
                  <span>Pi terminal</span>
                  <FeatureStatusBadge statusId="feature:composer.terminal-takeover" />
                </span>
              }
              icon={<SquareTerminal size={14} />}
              onClick={onOpenTakeoverTerminal}
              className={getFeatureStatusButtonClass("feature:composer.terminal-takeover")}
            />
          ) : null}
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
          <ToolbarButton
            label={
              <span className="inline-flex items-center gap-2">
                <span>{profileLabel}</span>
                <FeatureStatusBadge statusId="feature:composer.profile" />
              </span>
            }
            icon={<Settings size={14} />}
            onClick={() => onAction("composer.profile")}
            trailing
            className={getFeatureStatusButtonClass("feature:composer.profile")}
          />
        </div>
      </SurfacePanel>
    </>
  );
}
