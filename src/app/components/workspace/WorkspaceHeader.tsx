import {
  ChevronDown,
  FolderOpen,
  GitCommitHorizontal,
  GitCompareArrows,
  MoreHorizontal,
  PanelBottom,
  Play,
  SquareArrowOutUpRight,
} from "lucide-react";
import type { DesktopAction } from "../../desktop/actions";
import { getFeatureStatusButtonClass } from "../../features/feature-status";
import type { View } from "../../types";
import { cn } from "../../utils/cn";

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

const headerButtonClass =
  "inline-flex h-7 items-center justify-center rounded-[10px] border border-[color:var(--border)] bg-[rgba(39,43,57,0.72)] px-2 text-[12.5px] leading-none text-[color:var(--muted)] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] transition-colors duration-150 ease-out hover:bg-[rgba(46,50,66,0.84)] hover:text-[color:var(--text)]";

const headerIconButtonClass = `${headerButtonClass} w-9 px-0`;
const headerChevronButtonClass = `${headerButtonClass} w-[23px] px-0`;
const headerTextButtonClass = `${headerButtonClass} gap-1.5 px-2.5`;

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
  const isThreadView = activeView === "thread";
  const title = isThreadView ? currentTitle : "New thread";
  const projectName = currentProjectName || "Project";

  return (
    <header
      className={cn(
        "flex items-center justify-between gap-4 px-5 pt-2.5 pb-2",
        !sidebarVisible && "pl-16",
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="truncate text-[13.5px] text-[color:var(--text)]">{title}</span>

        {isThreadView ? (
          <>
            <button
              type="button"
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-[10px] border border-[color:var(--border)] bg-[rgba(39,43,57,0.72)] px-2 text-[12.5px] text-[color:var(--muted)] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] transition-colors duration-150 ease-out hover:bg-[rgba(46,50,66,0.84)] hover:text-[color:var(--text)]",
                getFeatureStatusButtonClass("feature:header.project-switch"),
              )}
              onClick={() => onAction("project.switch")}
              data-feature-id="feature:header.project-switch"
              data-feature-status="mock"
              aria-label="Project switcher"
              aria-haspopup="menu"
              aria-expanded={false}
              title="Project switcher"
            >
              <span className="truncate">{projectName}</span>
              <ChevronDown size={14} />
            </button>

            <button
              type="button"
              className={cn(
                headerIconButtonClass,
                getFeatureStatusButtonClass("feature:header.thread-actions"),
              )}
              onClick={() => onAction("thread.actions")}
              data-feature-id="feature:header.thread-actions"
              data-feature-status="mock"
              aria-label="Thread actions"
              aria-haspopup="menu"
              aria-expanded={false}
              title="Thread actions"
            >
              <MoreHorizontal size={15} />
            </button>
          </>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {isThreadView ? (
          <>
            <button
              type="button"
              className={cn(
                headerIconButtonClass,
                getFeatureStatusButtonClass("feature:header.thread-run-action"),
              )}
              onClick={() => onAction("thread.run-action")}
              data-feature-id="feature:header.thread-run-action"
              data-feature-status="mock"
              aria-label="Set up a run action"
              title="Set up a run action"
            >
              <Play size={14} />
            </button>

            <button
              type="button"
              className={cn(
                headerIconButtonClass,
                getFeatureStatusButtonClass("feature:header.open"),
              )}
              onClick={() => onAction("workspace.open")}
              data-feature-id="feature:header.open"
              data-feature-status="mock"
              aria-label="Open"
              title="Open"
            >
              <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-[5px] bg-[linear-gradient(135deg,#f6eb82,#7ab0ff)] text-[#171821]">
                <FolderOpen size={11} />
              </span>
            </button>
            <button
              type="button"
              className={cn(
                headerChevronButtonClass,
                getFeatureStatusButtonClass("feature:header.open-options"),
              )}
              onClick={() => onAction("workspace.open-options")}
              data-feature-id="feature:header.open-options"
              data-feature-status="mock"
              aria-label="Open options"
              aria-haspopup="menu"
              aria-expanded={false}
              title="Open options"
            >
              <ChevronDown size={13} />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={cn(
                headerIconButtonClass,
                getFeatureStatusButtonClass("feature:header.open"),
              )}
              onClick={() => onAction("workspace.open")}
              data-feature-id="feature:header.open"
              data-feature-status="mock"
              aria-label="Open"
              title="Open"
            >
              <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-[5px] bg-[linear-gradient(135deg,#f6eb82,#7ab0ff)] text-[#171821]">
                <FolderOpen size={11} />
              </span>
            </button>
            <button
              type="button"
              className={cn(
                headerChevronButtonClass,
                getFeatureStatusButtonClass("feature:header.open-options"),
              )}
              onClick={() => onAction("workspace.open-options")}
              data-feature-id="feature:header.open-options"
              data-feature-status="mock"
              aria-label="Open options"
              aria-haspopup="menu"
              aria-expanded={false}
              title="Open options"
            >
              <ChevronDown size={13} />
            </button>

            <button
              type="button"
              className={cn(
                headerTextButtonClass,
                getFeatureStatusButtonClass("feature:header.commit"),
              )}
              onClick={() => onAction("workspace.commit")}
              data-feature-id="feature:header.commit"
              data-feature-status="mock"
              aria-label="Commit"
              title="Commit"
            >
              <GitCommitHorizontal size={14} />
              <span>Commit</span>
            </button>
            <button
              type="button"
              className={cn(
                headerChevronButtonClass,
                getFeatureStatusButtonClass("feature:header.commit-options"),
              )}
              onClick={() => onAction("workspace.commit-options")}
              data-feature-id="feature:header.commit-options"
              data-feature-status="mock"
              aria-label="Commit options"
              aria-haspopup="menu"
              aria-expanded={false}
              title="Commit options"
            >
              <ChevronDown size={13} />
            </button>
          </>
        )}

        <div className="mx-1 h-5 w-px bg-[color:var(--border)]" />

        <button
          type="button"
          className={cn(
            headerIconButtonClass,
            terminalVisible && "bg-[rgba(183,186,245,0.09)] text-[color:var(--text)]",
            getFeatureStatusButtonClass("feature:header.terminal-toggle"),
          )}
          onClick={onToggleTerminal}
          data-feature-id="feature:header.terminal-toggle"
          data-feature-status="partial"
          aria-label="Toggle terminal"
          title="Toggle terminal"
          aria-pressed={terminalVisible}
        >
          <PanelBottom size={15} />
        </button>

        {isThreadView ? (
          <button
            type="button"
            className={cn(
              headerIconButtonClass,
              diffVisible && "bg-[rgba(183,186,245,0.09)] text-[color:var(--text)]",
              getFeatureStatusButtonClass("feature:header.diff-toggle"),
            )}
            onClick={onToggleDiff}
            data-feature-id="feature:header.diff-toggle"
            data-feature-status="partial"
            aria-label="Toggle diff panel"
            title="Toggle diff panel"
            aria-pressed={diffVisible}
          >
            <GitCompareArrows size={15} />
          </button>
        ) : (
          <button
            type="button"
            className={cn(
              "inline-flex h-7 items-center gap-2 rounded-[10px] border border-[color:var(--border)] bg-[rgba(39,43,57,0.72)] px-2.5 text-[12px] leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] transition-colors duration-150 ease-out hover:bg-[rgba(46,50,66,0.84)]",
              diffVisible && "bg-[rgba(183,186,245,0.09)] text-[color:var(--text)]",
              getFeatureStatusButtonClass("feature:header.diff-toggle"),
            )}
            onClick={onToggleDiff}
            data-feature-id="feature:header.diff-toggle"
            data-feature-status="partial"
            aria-label="Toggle diff panel"
            title="Toggle diff panel"
            aria-pressed={diffVisible}
          >
            <GitCompareArrows size={14} />
            <span className="text-[#79d3a2]">+4,274</span>
            <span className="text-[#ff8e8e]">-91</span>
          </button>
        )}

        <button
          type="button"
          className={cn(
            headerIconButtonClass,
            getFeatureStatusButtonClass("feature:header.workspace-popout"),
          )}
          onClick={() => onAction("workspace.popout")}
          data-feature-id="feature:header.workspace-popout"
          data-feature-status="mock"
          aria-label="Open in Popout Window"
          title="Open in Popout Window"
        >
          <SquareArrowOutUpRight size={14} />
        </button>
      </div>
    </header>
  );
}
