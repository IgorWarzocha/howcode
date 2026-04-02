import {
  ChevronDown,
  CopyPlus,
  Grip,
  MoreHorizontal,
  PanelBottom,
  PanelRight,
  Play,
} from "lucide-react";
import type { DesktopAction } from "../../desktop/actions";
import type { View } from "../../types";
import { IconButton } from "../common/IconButton";
import { TextButton } from "../common/TextButton";

type WorkspaceHeaderProps = {
  activeView: View;
  currentTitle: string;
  currentProjectName: string;
  sidebarVisible: boolean;
  terminalVisible: boolean;
  diffVisible: boolean;
  onAction: (action: DesktopAction, payload?: Record<string, unknown>) => void;
  onToggleTerminal: () => void;
  onToggleDiff: () => void;
};

export function WorkspaceHeader({
  activeView,
  currentTitle,
  currentProjectName,
  sidebarVisible,
  terminalVisible,
  diffVisible,
  onAction,
  onToggleTerminal,
  onToggleDiff,
}: WorkspaceHeaderProps) {
  return (
    <header
      className={
        sidebarVisible
          ? "grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 px-5 pt-2.5 pb-2 max-md:grid-cols-1"
          : "grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 px-5 pt-2.5 pb-2 pl-16 max-md:grid-cols-1"
      }
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2 truncate text-[12.5px] leading-5 text-[color:var(--muted)]">
          <span className="truncate text-[13.5px] text-[color:var(--text)]">{currentTitle}</span>
          {activeView === "thread" ? (
            <>
              <TextButton
                className="px-0.5 py-0 text-[12px] text-[color:var(--muted)] hover:text-[color:var(--text)]"
                onClick={() => onAction("project.switch")}
              >
                {currentProjectName}
              </TextButton>
              <IconButton
                label="Thread actions"
                onClick={() => onAction("thread.actions")}
                icon={<MoreHorizontal size={16} />}
              />
              <IconButton
                label="Set up a run action"
                onClick={() => onAction("thread.run-action")}
                icon={<Play size={16} />}
              />
            </>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[rgba(39,43,57,0.72)] px-2.5 text-[color:var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
        onClick={() => onAction("product.menu")}
      >
        <div className="inline-flex h-5 w-5 items-center justify-center rounded-[6px] bg-[linear-gradient(135deg,#f6eb82,#7ab0ff)] text-[11px] font-bold text-[#171821]">
          P
        </div>
        <ChevronDown size={14} className="text-[color:var(--muted)]" />
      </button>

      <div className="flex items-center gap-2 max-md:flex-wrap">
        <div className="h-5 w-px bg-[color:var(--border)] max-md:hidden" />
        <IconButton
          label="Toggle terminal"
          active={terminalVisible}
          onClick={onToggleTerminal}
          icon={<PanelBottom size={16} />}
        />
        <IconButton
          label="Toggle diff panel"
          active={diffVisible}
          onClick={onToggleDiff}
          icon={<PanelRight size={16} />}
        />
        <IconButton
          label="Open in Popout Window"
          onClick={() => onAction("workspace.popout")}
          icon={<Grip size={16} />}
        />
        <IconButton
          label="Duplicate workspace"
          onClick={() => onAction("workspace.secondary")}
          icon={<CopyPlus size={16} />}
        />
      </div>
    </header>
  );
}
