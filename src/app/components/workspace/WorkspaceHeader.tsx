import {
  ArrowLeftRight,
  ChevronDown,
  FolderOpen,
  MoreHorizontal,
  Play,
  SquareArrowOutUpRight,
} from "lucide-react";
import type { DesktopAction } from "../../desktop/actions";
import type { ProjectGitState } from "../../desktop/types";
import { type FeatureStatusId, getFeatureStatusAccentClass } from "../../features/feature-status";
import type { View } from "../../types";
import { cn } from "../../utils/cn";

type WorkspaceHeaderProps = {
  activeView: View;
  currentTitle: string;
  currentProjectName: string;
  sidebarVisible: boolean;
  projectGitState: ProjectGitState | null;
  onAction: (action: DesktopAction, payload?: Record<string, unknown>) => void;
};

const headerSurfaceButtonClass =
  "relative inline-flex h-7 items-center justify-center rounded-lg border border-[rgba(107,115,150,0.18)] bg-[rgba(39,43,57,0.72)] text-[color:var(--muted)] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] transition-colors duration-150 ease-out hover:bg-[rgba(46,50,66,0.84)] hover:text-[color:var(--text)]";

const headerSplitIconButtonClass = `${headerSurfaceButtonClass} w-8`;
const headerChevronButtonClass = `${headerSurfaceButtonClass} w-6`;
const headerTextButtonClass = `${headerSurfaceButtonClass} gap-1.5 px-2.5 text-[12.5px] leading-none`;
const headerQuietIconButtonClass =
  "relative inline-flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-[color:var(--muted)] transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]";
const headerDividerClass = "mx-1 h-5 w-px bg-[rgba(121,128,160,0.18)]";
const headerOptionalControlClass = "max-[1200px]:hidden";

type HeaderStatusDotProps = {
  statusId: FeatureStatusId;
};

function HeaderStatusDot({ statusId }: HeaderStatusDotProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full border p-0",
        getFeatureStatusAccentClass(statusId),
      )}
    />
  );
}

export function WorkspaceHeader({
  activeView,
  currentTitle,
  currentProjectName,
  sidebarVisible,
  projectGitState,
  onAction,
}: WorkspaceHeaderProps) {
  void currentTitle;
  const isThreadView = activeView === "thread";
  const projectName = currentProjectName || "Project";
  const isGitRepo = projectGitState?.isGitRepo ?? false;

  return (
    <header
      className={cn(
        "flex min-w-0 items-center justify-between gap-4 px-5 pt-2.5 pb-2",
        !sidebarVisible && "pl-16",
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {isThreadView ? (
          <>
            <button
              type="button"
              className={cn(headerTextButtonClass, "h-6.5 gap-1 px-2 text-[12px]")}
              onClick={() => onAction("project.switch")}
              data-feature-id="feature:header.project-switch"
              data-feature-status="mock"
              aria-label="Project switcher"
              aria-haspopup="menu"
              aria-expanded={false}
              title="Project switcher"
            >
              <span className="max-w-[180px] truncate text-[color:var(--muted)]">
                {projectName}
              </span>
              <ChevronDown size={13} />
              <HeaderStatusDot statusId="feature:header.project-switch" />
            </button>

            <button
              type="button"
              className={headerQuietIconButtonClass}
              onClick={() => onAction("thread.actions")}
              data-feature-id="feature:header.thread-actions"
              data-feature-status="mock"
              aria-label="Thread actions"
              aria-haspopup="menu"
              aria-expanded={false}
              title="Thread actions"
            >
              <MoreHorizontal size={15} />
              <HeaderStatusDot statusId="feature:header.thread-actions" />
            </button>
          </>
        ) : null}
      </div>

      <div className="flex min-w-0 shrink-0 items-center gap-1.5">
        <button
          type="button"
          className={cn(headerQuietIconButtonClass, headerOptionalControlClass)}
          onClick={() => onAction("thread.run-action")}
          data-feature-id="feature:header.thread-run-action"
          data-feature-status="mock"
          aria-label="Set up a run action"
          title="Set up a run action"
        >
          <Play size={14} />
          <HeaderStatusDot statusId="feature:header.thread-run-action" />
        </button>

        <button
          type="button"
          className={cn(headerSplitIconButtonClass, headerOptionalControlClass)}
          onClick={() => onAction("workspace.open")}
          data-feature-id="feature:header.open"
          data-feature-status="mock"
          aria-label="Open"
          title="Open"
        >
          <span className="inline-flex h-[16px] w-[16px] items-center justify-center rounded-[4px] bg-[linear-gradient(135deg,#f6eb82,#7ab0ff)] text-[#171821]">
            <FolderOpen size={10} />
          </span>
          <HeaderStatusDot statusId="feature:header.open" />
        </button>
        <button
          type="button"
          className={cn(headerChevronButtonClass, headerOptionalControlClass)}
          onClick={() => onAction("workspace.open-options")}
          data-feature-id="feature:header.open-options"
          data-feature-status="mock"
          aria-label="Open options"
          aria-haspopup="menu"
          aria-expanded={false}
          title="Open options"
        >
          <ChevronDown size={13} />
          <HeaderStatusDot statusId="feature:header.open-options" />
        </button>

        {isGitRepo ? (
          <>
            <button
              type="button"
              className={cn(headerTextButtonClass, headerOptionalControlClass)}
              onClick={() => onAction("workspace.handoff")}
              data-feature-id="feature:header.handoff"
              data-feature-status="mock"
              aria-label="Handoff"
              title="Handoff"
            >
              <ArrowLeftRight size={13} />
              <span>Handoff</span>
              <HeaderStatusDot statusId="feature:header.handoff" />
            </button>
          </>
        ) : null}

        <div className={cn(headerDividerClass, headerOptionalControlClass)} />

        <button
          type="button"
          className={cn(headerQuietIconButtonClass, headerOptionalControlClass)}
          onClick={() => onAction("workspace.popout")}
          data-feature-id="feature:header.workspace-popout"
          data-feature-status="mock"
          aria-label="Open in Popout Window"
          title="Open in Popout Window"
        >
          <SquareArrowOutUpRight size={13} />
          <HeaderStatusDot statusId="feature:header.workspace-popout" />
        </button>
      </div>
    </header>
  );
}
