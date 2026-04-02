import { SquareTerminal, X } from "lucide-react";
import type { FeatureStatusId } from "../../features/feature-status";
import { panelChromeClass } from "../../ui/classes";
import { cn } from "../../utils/cn";
import { FeatureStatusBadge } from "../common/FeatureStatusBadge";
import { TerminalViewport } from "./terminal/TerminalViewport";

type TerminalPanelProps = {
  projectId: string;
  sessionPath: string | null;
  onClose: () => void;
  mode?: "docked" | "takeover";
};

export function TerminalPanel({
  projectId,
  sessionPath,
  onClose,
  mode = "docked",
}: TerminalPanelProps) {
  const statusId: FeatureStatusId = "feature:terminal.panel";
  const closeLabel = mode === "takeover" ? "Return to chat" : "Close terminal";
  const panelClass =
    mode === "takeover"
      ? "flex h-full min-h-0 flex-col gap-1.5 rounded-[18px] border border-[rgba(169,178,215,0.06)] bg-[rgba(33,36,49,0.88)] p-2.5 shadow-[var(--shadow)]"
      : cn(panelChromeClass, "flex h-full min-h-0 flex-col gap-2.5 p-3");

  return (
    <section
      aria-label="Terminal panel"
      className={panelClass}
      data-feature-id="feature:terminal.panel"
      data-feature-status="partial"
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 text-[12px] text-[color:var(--muted)]">
          <SquareTerminal size={14} />
          <span className="font-medium text-[color:var(--text)]/90">
            {mode === "takeover" ? "Pi terminal" : "Terminal"}
          </span>
          <FeatureStatusBadge statusId={statusId} />
        </div>
        <button
          type="button"
          className="inline-flex h-7 w-7 items-center justify-center rounded-[9px] text-[color:var(--muted)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]"
          aria-label={closeLabel}
          title={closeLabel}
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-[14px] border border-[rgba(137,146,183,0.06)] bg-[rgba(23,25,35,0.98)] p-1">
        <TerminalViewport
          projectId={projectId}
          sessionPath={sessionPath}
          launchMode={mode === "takeover" ? "pi-session" : "shell"}
          preserveSessionOnUnmount={mode === "docked"}
        />
      </div>
    </section>
  );
}
