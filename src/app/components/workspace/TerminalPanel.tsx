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
};

export function TerminalPanel({ projectId, sessionPath, onClose }: TerminalPanelProps) {
  const statusId: FeatureStatusId = "feature:terminal.panel";

  return (
    <section
      aria-label="Terminal panel"
      className={cn(panelChromeClass, "grid gap-2.5 p-3")}
      data-feature-id="feature:terminal.panel"
      data-feature-status="partial"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono text-xs">
          <SquareTerminal size={14} />
          <span>Terminal</span>
          <FeatureStatusBadge statusId={statusId} />
        </div>
        <button
          type="button"
          className="inline-flex h-7 w-7 items-center justify-center rounded-[9px] text-[color:var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[color:var(--text)]"
          aria-label="Close terminal"
          title="Close terminal"
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </div>
      <div className="overflow-hidden rounded-[14px] border border-[rgba(137,146,183,0.08)] bg-[rgba(18,20,28,0.92)] p-1.5">
        <TerminalViewport projectId={projectId} sessionPath={sessionPath} />
      </div>
    </section>
  );
}
