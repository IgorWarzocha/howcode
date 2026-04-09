import { Columns2, PanelRightClose, Rows3, Send, SlidersHorizontal } from "lucide-react";
import type { DesktopActionInvoker } from "../../../desktop/types";
import { getFeatureStatusButtonClass } from "../../../features/feature-status";
import { diffPanelIconButtonClass, diffPanelTurnChipSelectedClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";

type DiffRenderMode = "stacked" | "split";

type DiffPanelToolbarProps = {
  diffRenderMode: DiffRenderMode;
  commentCount: number;
  commentsSending: boolean;
  showCloseButton: boolean;
  onClose?: () => void;
  onAction: DesktopActionInvoker;
  onSendCommentsToAgent: () => void;
  onSetDiffRenderMode: (mode: DiffRenderMode) => void;
};

export function DiffPanelToolbar({
  diffRenderMode,
  commentCount,
  commentsSending,
  showCloseButton,
  onClose,
  onAction,
  onSendCommentsToAgent,
  onSetDiffRenderMode,
}: DiffPanelToolbarProps) {
  return (
    <div className="flex h-11 items-center justify-between gap-2 border-b border-[color:var(--border)] px-3 py-1.5">
      <div className="flex min-w-0 flex-1 items-center text-[11px] font-medium uppercase tracking-[0.12em] text-[color:var(--muted)]">
        Worktree diff
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          className={cn(
            diffPanelIconButtonClass,
            "w-auto gap-1.5 border-[color:var(--border)] bg-transparent px-2",
            commentCount === 0 && "cursor-not-allowed opacity-45",
          )}
          onClick={onSendCommentsToAgent}
          disabled={commentCount === 0 || commentsSending}
          aria-label="Send review comments to agent"
          title="Send review comments to agent"
        >
          <Send size={13} />
          <span className="text-[11px] font-medium">
            {commentsSending
              ? "Sending…"
              : `Send to agent${commentCount > 0 ? ` (${commentCount})` : ""}`}
          </span>
        </button>
        <button
          type="button"
          className={cn(
            diffPanelIconButtonClass,
            diffRenderMode === "stacked"
              ? diffPanelTurnChipSelectedClass
              : "border-[color:var(--border)] bg-transparent",
          )}
          onClick={() => onSetDiffRenderMode("stacked")}
          aria-label="Unified diff view"
          title="Unified diff view"
        >
          <Rows3 size={14} />
        </button>
        <button
          type="button"
          className={cn(
            diffPanelIconButtonClass,
            diffRenderMode === "split"
              ? diffPanelTurnChipSelectedClass
              : "border-[color:var(--border)] bg-transparent",
          )}
          onClick={() => onSetDiffRenderMode("split")}
          aria-label="Split diff view"
          title="Split diff view"
        >
          <Columns2 size={14} />
        </button>
        <button
          type="button"
          className={cn(
            diffPanelIconButtonClass,
            "border-[color:var(--border)] bg-transparent",
            getFeatureStatusButtonClass("feature:diff.review"),
          )}
          onClick={() => onAction("diff.review")}
          aria-label="Diff panel actions"
          title="Diff panel actions"
        >
          <SlidersHorizontal size={14} />
        </button>
        {showCloseButton && onClose ? (
          <button
            type="button"
            className={cn(diffPanelIconButtonClass, "border-[color:var(--border)] bg-transparent")}
            onClick={onClose}
            aria-label="Close diff panel"
            title="Close diff panel"
          >
            <PanelRightClose size={14} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
