import { ChevronDown, Globe, Mic, Plus, Send, Settings, SquareTerminal, X } from "lucide-react";
import type { DesktopAction } from "../../desktop/actions";
import type { View } from "../../types";
import { IconButton } from "../common/IconButton";
import { PrimaryButton } from "../common/PrimaryButton";
import { SurfacePanel } from "../common/SurfacePanel";
import { ToolbarButton } from "../common/ToolbarButton";

type ComposerProps = {
  activeView: View;
  hostLabel: string;
  profileLabel: string;
  onAction: (action: DesktopAction, payload?: Record<string, unknown>) => void;
};

export function Composer({ activeView, hostLabel, profileLabel, onAction }: ComposerProps) {
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

      <SurfacePanel className="grid gap-2.5 p-2.5">
        <textarea
          className="min-h-[98px] w-full resize-none bg-transparent px-1.5 pt-1 text-[15px] text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted-2)]"
          placeholder={
            activeView === "thread"
              ? "Ask for follow-up changes"
              : "Ask Pi anything, @ to add files, / for commands, $ for skills"
          }
        />
        <div className="flex items-center justify-between gap-2 px-1 max-md:flex-wrap">
          <div className="flex items-center gap-2 max-md:flex-wrap">
            <ToolbarButton
              label="Add files and more"
              icon={<Plus size={16} />}
              onClick={() => onAction("composer.attach-menu")}
            />
            <ToolbarButton
              label="GPT-5.4"
              icon={<ChevronDown size={14} />}
              onClick={() => onAction("composer.model")}
              trailing
            />
            <ToolbarButton
              label="High"
              icon={<ChevronDown size={14} />}
              onClick={() => onAction("composer.thinking")}
              trailing
            />
            <ToolbarButton
              label="Dictate"
              icon={<Mic size={15} />}
              onClick={() => onAction("composer.dictate")}
            />
          </div>

          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(146,153,184,0.42)] text-[color:var(--workspace)]"
            onClick={() => onAction("composer.send")}
            aria-label="Send"
          >
            <Send size={16} />
          </button>
        </div>

        <div className="h-px bg-[color:var(--border)]" />

        <div className="flex items-center gap-2 px-1 text-[color:var(--muted)] max-md:flex-wrap">
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
