import { AtSign, SquareTerminal, X } from "lucide-react";
import type { DesktopAction } from "../../desktop/actions";
import { terminalOutputClass } from "../../ui/classes";
import { SurfacePanel } from "../common/SurfacePanel";

type TerminalPanelProps = {
  onAction: (action: DesktopAction, payload?: Record<string, unknown>) => void;
};

export function TerminalPanel({ onAction }: TerminalPanelProps) {
  return (
    <SurfacePanel className="grid gap-2.5 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono text-xs">
          <SquareTerminal size={14} />
          <span>Terminal</span>
          <span className="text-[color:var(--muted)]">fish</span>
        </div>
        <button
          type="button"
          className="inline-flex h-7 w-7 items-center justify-center rounded-[9px] text-[color:var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[color:var(--text)]"
          aria-label="Close terminal"
          title="Close terminal"
          onClick={() => onAction("terminal.close")}
        >
          <X size={14} />
        </button>
      </div>
      <div className={terminalOutputClass}>
        <div className="truncate">
          <span className="text-[#b9c8ff]">~/Work/howcode</span>{" "}
          <span className="text-[color:var(--green)]">❯</span> npm run dev
        </div>
        <div className="truncate text-[color:var(--muted)]">
          ➜ Launching Pi Desktop Mock UI with Electron shell
        </div>
        <div className="truncate text-[color:var(--muted)]">
          ➜ Future hook: createAgentSession() adapter + event stream
        </div>
      </div>
      <div className="flex items-center gap-2 px-0.5 font-mono text-xs text-[color:var(--muted)]">
        <AtSign size={14} />
        <input
          aria-label="Terminal input"
          value=""
          readOnly
          placeholder="Terminal input"
          className="flex-1 border-0 bg-transparent text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted)]"
        />
      </div>
    </SurfacePanel>
  );
}
