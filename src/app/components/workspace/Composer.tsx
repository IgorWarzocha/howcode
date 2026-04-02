import {
  Check,
  ChevronDown,
  Globe,
  Mic,
  Plus,
  Send,
  Settings,
  SquareTerminal,
  X,
} from "lucide-react";
import { useState } from "react";
import type { DesktopAction } from "../../desktop/actions";
import type { ComposerAttachment, ComposerModel, ComposerThinkingLevel } from "../../desktop/types";
import { getFeatureStatusButtonClass } from "../../features/feature-status";
import type { View } from "../../types";
import { FeatureStatusBadge } from "../common/FeatureStatusBadge";
import { IconButton } from "../common/IconButton";
import { PrimaryButton } from "../common/PrimaryButton";
import { SurfacePanel } from "../common/SurfacePanel";
import { ToolbarButton } from "../common/ToolbarButton";

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
  onPickAttachments: (projectId?: string | null) => Promise<ComposerAttachment[]>;
  onAction: (action: DesktopAction, payload?: Record<string, unknown>) => Promise<void>;
};

const thinkingLevelLabels: Record<ComposerThinkingLevel, string> = {
  off: "Off",
  minimal: "Minimal",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "X-High",
};

function getModelLabel(model: ComposerModel | null) {
  if (!model) {
    return "No model";
  }

  return model.name;
}

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
  onPickAttachments,
  onAction,
}: ComposerProps) {
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [thinkingMenuOpen, setThinkingMenuOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSend = draft.trim().length > 0 && !isSending;

  const runComposerAction = async (action: DesktopAction, payload: Record<string, unknown>) => {
    try {
      await onAction(action, payload);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not update the composer.");
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || isSending) {
      return;
    }

    setIsSending(true);
    setErrorMessage(null);

    try {
      await onAction("composer.send", {
        text,
        attachments,
        projectId,
        sessionPath,
      });
      setDraft("");
      setAttachments([]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not send prompt.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      {activeView === "home" ? (
        <SurfacePanel className="flex items-center justify-between gap-4 px-5 py-4 max-md:flex-wrap">
          <div className="flex items-center gap-4">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--muted)]">
              <Globe size={16} />
            </div>
            <div>
              <div className="mb-1 inline-flex items-center gap-2 text-[15px] text-[color:var(--text)]">
                Let Pi work while you’re away
                <FeatureStatusBadge statusId="feature:composer.remote-connections" />
              </div>
              <div className="text-[color:var(--muted)]">
                Run your threads on a remote machine and pick back up when you return.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 max-md:flex-wrap">
            <PrimaryButton
              className={getFeatureStatusButtonClass("feature:composer.connections.add")}
              onClick={() => onAction("connections.add")}
            >
              Add Connections
              <FeatureStatusBadge
                statusId="feature:composer.connections.add"
                className="ml-2 align-middle"
              />
            </PrimaryButton>
            <IconButton
              label="Dismiss remote connections banner"
              onClick={() => onAction("connections.dismiss-banner")}
              icon={<X size={16} />}
              className={getFeatureStatusButtonClass("feature:composer.connections.dismiss")}
            />
          </div>
        </SurfacePanel>
      ) : null}

      <SurfacePanel className="grid gap-0 overflow-hidden shadow-none">
        {attachments.length > 0 ? (
          <div className="flex flex-wrap gap-2 px-3.5 pt-3 pb-0.5">
            {attachments.map((attachment) => (
              <button
                key={attachment.path}
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(255,255,255,0.04)] px-2.5 py-1 text-[12px] text-[color:var(--text)]"
                onClick={() =>
                  setAttachments((current) =>
                    current.filter(
                      (currentAttachment) => currentAttachment.path !== attachment.path,
                    ),
                  )
                }
              >
                <span className="text-[color:var(--muted)]">
                  {attachment.kind === "image" ? "Image" : "File"}
                </span>
                <span>{attachment.name}</span>
                <X size={12} />
              </button>
            ))}
          </div>
        ) : null}
        <textarea
          className="min-h-[86px] w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-[14px] leading-[1.45] text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted-2)]"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onInput={() => {
            if (errorMessage) {
              setErrorMessage(null);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
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
              onClick={async () => {
                let nextAttachments: ComposerAttachment[] = [];

                try {
                  nextAttachments = await onPickAttachments(projectId);
                } catch (error) {
                  setErrorMessage(
                    error instanceof Error ? error.message : "Could not open the file picker.",
                  );
                  return;
                }

                if (nextAttachments.length === 0) {
                  return;
                }

                setAttachments((current) => {
                  const byPath = new Map(
                    current.map((attachment) => [attachment.path, attachment]),
                  );

                  for (const attachment of nextAttachments) {
                    byPath.set(attachment.path, attachment);
                  }

                  return [...byPath.values()];
                });
                setErrorMessage(null);
              }}
            />
            <div className="relative">
              <ToolbarButton
                label={getModelLabel(model)}
                icon={<ChevronDown size={14} />}
                onClick={() => {
                  setModelMenuOpen((current) => !current);
                  setThinkingMenuOpen(false);
                }}
                trailing
              />
              {modelMenuOpen ? (
                <SurfacePanel className="absolute bottom-[calc(100%+8px)] left-0 z-30 grid max-h-[280px] w-[280px] overflow-y-auto rounded-[16px] border-[color:var(--border-strong)] bg-[rgba(39,42,57,0.98)] p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
                  {availableModels.map((availableModel) => {
                    const isSelected =
                      model?.provider === availableModel.provider && model.id === availableModel.id;

                    return (
                      <button
                        key={`${availableModel.provider}/${availableModel.id}`}
                        type="button"
                        className="grid grid-cols-[16px_minmax(0,1fr)] items-center gap-2 rounded-[12px] px-2.5 py-2 text-left text-[13px] text-[color:var(--text)] hover:bg-[rgba(255,255,255,0.04)]"
                        onClick={() => {
                          setModelMenuOpen(false);
                          void runComposerAction("composer.model", {
                            provider: availableModel.provider,
                            modelId: availableModel.id,
                            projectId,
                            sessionPath,
                          });
                        }}
                      >
                        <span className="inline-flex items-center justify-center text-[color:var(--accent)]">
                          {isSelected ? <Check size={14} /> : null}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate">{availableModel.name}</span>
                          <span className="block truncate text-[11px] text-[color:var(--muted)]">
                            {availableModel.provider}/{availableModel.id}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </SurfacePanel>
              ) : null}
            </div>
            <div className="relative">
              <ToolbarButton
                label={thinkingLevelLabels[thinkingLevel]}
                icon={<ChevronDown size={14} />}
                onClick={() => {
                  setThinkingMenuOpen((current) => !current);
                  setModelMenuOpen(false);
                }}
                trailing
              />
              {thinkingMenuOpen ? (
                <SurfacePanel className="absolute bottom-[calc(100%+8px)] left-0 z-30 grid w-[180px] rounded-[16px] border-[color:var(--border-strong)] bg-[rgba(39,42,57,0.98)] p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
                  {availableThinkingLevels.map((level) => {
                    const isSelected = level === thinkingLevel;

                    return (
                      <button
                        key={level}
                        type="button"
                        className="grid grid-cols-[16px_minmax(0,1fr)] items-center gap-2 rounded-[12px] px-2.5 py-2 text-left text-[13px] text-[color:var(--text)] hover:bg-[rgba(255,255,255,0.04)]"
                        onClick={() => {
                          setThinkingMenuOpen(false);
                          void runComposerAction("composer.thinking", {
                            level,
                            projectId,
                            sessionPath,
                          });
                        }}
                      >
                        <span className="inline-flex items-center justify-center text-[color:var(--accent)]">
                          {isSelected ? <Check size={14} /> : null}
                        </span>
                        <span>{thinkingLevelLabels[level]}</span>
                      </button>
                    );
                  })}
                </SurfacePanel>
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
          <div className="px-3.5 pb-2 text-[12px] text-[#f2a7a7]">{errorMessage}</div>
        ) : null}

        <div className="h-px bg-[rgba(169,178,215,0.07)]" />

        <div className="flex items-center gap-1.5 px-3.5 pt-2 pb-3 text-[color:var(--muted)] max-md:flex-wrap">
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
