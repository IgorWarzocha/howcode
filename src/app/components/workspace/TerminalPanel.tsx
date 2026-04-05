import { SquareTerminal, X } from "lucide-react";
import type { DesktopAction } from "../../desktop/actions";
import {
  type FeatureStatusId,
  getFeatureStatusDataAttributes,
} from "../../features/feature-status";
import { iconButtonClass, panelChromeClass } from "../../ui/classes";
import { cn } from "../../utils/cn";
import { FeatureStatusBadge } from "../common/FeatureStatusBadge";
import { SurfacePanel } from "../common/SurfacePanel";
import { ToolbarButton } from "../common/ToolbarButton";
import { TerminalViewport } from "./terminal/TerminalViewport";

type TerminalPanelProps = {
  projectId: string;
  sessionPath: string | null;
  onClose: () => void;
  mode?: "docked" | "takeover";
  hostLabel?: string;
  onAction?: (action: DesktopAction, payload?: Record<string, unknown>) => void | Promise<void>;
};

export function TerminalPanel({
  projectId,
  sessionPath,
  onClose,
  mode = "docked",
  hostLabel = "Local",
  onAction,
}: TerminalPanelProps) {
  const statusId: FeatureStatusId = "feature:terminal.panel";

  if (mode === "takeover") {
    return (
      <SurfacePanel
        aria-label="Pi terminal panel"
        className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-2xl border-[rgba(169,178,215,0.06)] bg-[rgba(39,42,57,0.94)] shadow-none"
        {...getFeatureStatusDataAttributes(statusId)}
      >
        <div className="flex min-h-0 min-w-0 overflow-hidden px-2.5 pt-2.5">
          <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-t-2xl rounded-b-none bg-[color:var(--terminal-bg)]">
            <TerminalViewport
              projectId={projectId}
              sessionPath={sessionPath}
              launchMode="pi-session"
              className="terminal-viewport--flush min-h-0 rounded-none border-0 bg-transparent"
            />
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-4 pt-2 pb-3 text-[color:var(--muted)] max-md:flex-wrap">
          <div className="flex items-center gap-1.5 text-[color:var(--muted)] max-md:flex-wrap">
            <ToolbarButton
              label={
                <span className="inline-flex items-center gap-2">
                  <span>Pi desktop</span>
                  <FeatureStatusBadge statusId={statusId} />
                </span>
              }
              icon={<SquareTerminal size={14} />}
              onClick={onClose}
            />
            <ToolbarButton
              label={hostLabel}
              icon={<SquareTerminal size={14} />}
              onClick={() => void onAction?.("composer.host")}
              trailing
            />
          </div>
        </div>
      </SurfacePanel>
    );
  }

  const panelClass = cn(panelChromeClass, "flex h-full min-h-0 flex-col gap-2.5 p-3");

  return (
    <section
      aria-label="Terminal panel"
      className={panelClass}
      {...getFeatureStatusDataAttributes(statusId)}
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 text-[12px] text-[color:var(--muted)]">
          <SquareTerminal size={14} />
          <span className="font-medium text-[color:var(--text)]/90">Terminal</span>
          <FeatureStatusBadge statusId={statusId} />
        </div>
        <button
          type="button"
          className={iconButtonClass}
          aria-label="Close terminal"
          title="Close terminal"
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl border border-[rgba(137,146,183,0.06)] bg-[rgba(23,25,35,0.98)] p-1">
        <TerminalViewport
          projectId={projectId}
          sessionPath={sessionPath}
          launchMode="shell"
          preserveSessionOnUnmount
        />
      </div>
    </section>
  );
}
