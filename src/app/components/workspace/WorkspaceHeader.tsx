import { ChevronDown, Grip, MoreHorizontal, PanelBottom, PanelRight, Play } from "lucide-react";
import type { DesktopAction } from "../../desktop/actions";
import type { View } from "../../types";
import { IconButton } from "../common/IconButton";
import { SplitButton } from "../common/SplitButton";
import { TextButton } from "../common/TextButton";

type WorkspaceHeaderProps = {
  activeView: View;
  currentTitle: string;
  currentProjectName: string;
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
  terminalVisible,
  diffVisible,
  onAction,
  onToggleTerminal,
  onToggleDiff,
}: WorkspaceHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4 px-[18px] pt-3.5 pb-2.5 max-md:flex-wrap">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2 truncate text-sm">
          <span className="truncate text-base">{currentTitle}</span>
          {activeView === "thread" ? (
            <>
              <TextButton onClick={() => onAction("project.switch")}>
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

      <div className="flex items-center gap-2 max-md:flex-wrap">
        <SplitButton
          primaryLabel="Open"
          secondaryLabel="Secondary action"
          onPrimary={() => onAction("workspace.open")}
          onSecondary={() => onAction("workspace.secondary")}
        />
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
        <button
          type="button"
          className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-[color:var(--border-strong)] bg-[rgba(39,43,57,0.9)] px-2.5"
          onClick={() => onAction("product.menu")}
        >
          <div className="inline-flex h-5 w-5 items-center justify-center rounded-[6px] bg-[linear-gradient(135deg,#f5eb84,#7ab0ff)] text-[11px] font-bold text-[#171821]">
            P
          </div>
          <ChevronDown size={14} />
        </button>
      </div>
    </header>
  );
}
