import { PanelBottom, PanelRight, Play } from "lucide-react";
import type { RefObject } from "react";
import { HeaderMenu } from "./HeaderMenu";

type RunActionMenuProps = {
  diffVisible: boolean;
  menuId: string;
  panelRef: RefObject<HTMLDivElement | null>;
  terminalVisible: boolean;
  onOpenBoth: () => void;
  onToggleDiff: () => void;
  onToggleTerminal: () => void;
};

export function RunActionMenu({
  diffVisible,
  menuId,
  panelRef,
  terminalVisible,
  onOpenBoth,
  onToggleDiff,
  onToggleTerminal,
}: RunActionMenuProps) {
  return (
    <HeaderMenu ariaLabel="Run actions" menuId={menuId} panelRef={panelRef}>
      <button
        type="button"
        role="menuitem"
        className="flex items-center gap-2.5 rounded-[11px] px-2.5 py-2 text-left text-[13px] text-[color:var(--text)] transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.04)]"
        onClick={onToggleTerminal}
      >
        <PanelBottom size={14} className="text-[color:var(--muted)]" />
        <span>{terminalVisible ? "Hide terminal panel" : "Show terminal panel"}</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="flex items-center gap-2.5 rounded-[11px] px-2.5 py-2 text-left text-[13px] text-[color:var(--text)] transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.04)]"
        onClick={onToggleDiff}
      >
        <PanelRight size={14} className="text-[color:var(--muted)]" />
        <span>{diffVisible ? "Hide diff panel" : "Show diff panel"}</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="flex items-center gap-2.5 rounded-[11px] px-2.5 py-2 text-left text-[13px] text-[color:var(--text)] transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.04)]"
        onClick={onOpenBoth}
      >
        <Play size={14} className="text-[color:var(--muted)]" />
        <span>Open both panels</span>
      </button>
    </HeaderMenu>
  );
}
