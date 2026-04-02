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
import type { ComposerModel, ComposerThinkingLevel } from "../../desktop/types";
import type { View } from "../../types";
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
  onAction,
}: ComposerProps) {
  const [draft, setDraft] = useState("");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [thinkingMenuOpen, setThinkingMenuOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const canSend = draft.trim().length > 0 && !isSending;

  const send = async () => {
    const text = draft.trim();
    if (!text || isSending) {
      return;
    }

    setIsSending(true);

    try {
      await onAction("composer.send", {
        text,
        projectId,
        sessionPath,
      });
      setDraft("");
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
              <div className="mb-1 text-[15px] text-[color:var(--text)]">
                Let Pi work while you’re away
              </div>
              <div className="text-[color:var(--muted)]">
                Run your threads on a remote machine and pick back up when you return.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 max-md:flex-wrap">
            <PrimaryButton onClick={() => onAction("connections.add")}>
              Add Connections
            </PrimaryButton>
            <IconButton
              label="Dismiss remote connections banner"
              onClick={() => onAction("connections.dismiss-banner")}
              icon={<X size={16} />}
            />
          </div>
        </SurfacePanel>
      ) : null}

      <SurfacePanel className="grid gap-0 overflow-hidden shadow-none">
        <textarea
          className="min-h-[86px] w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-[14px] leading-[1.45] text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted-2)]"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
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
              onClick={() => onAction("composer.attach-menu")}
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
                          void onAction("composer.model", {
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
                          void onAction("composer.thinking", {
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
              label="Dictate"
              icon={<Mic size={15} />}
              onClick={() => onAction("composer.dictate")}
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

        <div className="h-px bg-[rgba(169,178,215,0.07)]" />

        <div className="flex items-center gap-1.5 px-3.5 pt-2 pb-3 text-[color:var(--muted)] max-md:flex-wrap">
          <ToolbarButton
            label={hostLabel}
            icon={<SquareTerminal size={14} />}
            onClick={() => onAction("composer.host")}
            trailing
          />
          <ToolbarButton
            label={profileLabel}
            icon={<Settings size={14} />}
            onClick={() => onAction("composer.profile")}
            trailing
          />
        </div>
      </SurfacePanel>
    </>
  );
}
