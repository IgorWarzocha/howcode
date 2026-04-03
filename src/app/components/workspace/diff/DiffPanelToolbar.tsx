import { Columns2, PanelRightClose, Rows3, SlidersHorizontal } from "lucide-react";
import type { DesktopAction } from "../../../desktop/actions";
import type { ThreadData } from "../../../desktop/types";
import { getFeatureStatusButtonClass } from "../../../features/feature-status";
import {
  diffPanelIconButtonClass,
  diffPanelTurnChipBaseClass,
  diffPanelTurnChipSelectedClass,
  diffPanelTurnChipUnselectedClass,
} from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import { formatTurnChipTimestamp } from "./diff-panel-content.helpers";

type DiffRenderMode = "stacked" | "split";

type DiffPanelToolbarProps = {
  diffRenderMode: DiffRenderMode;
  orderedTurnDiffSummaries: ThreadData["turnDiffSummaries"];
  selectedTurnCount: number | null;
  onClose: () => void;
  onAction: (action: DesktopAction, payload?: Record<string, unknown>) => void;
  onSelectTurn: (checkpointTurnCount: number | null) => void;
  onSetDiffRenderMode: (mode: DiffRenderMode) => void;
};

export function DiffPanelToolbar({
  diffRenderMode,
  orderedTurnDiffSummaries,
  selectedTurnCount,
  onClose,
  onAction,
  onSelectTurn,
  onSetDiffRenderMode,
}: DiffPanelToolbarProps) {
  return (
    <div className="flex h-11 items-center justify-between gap-2 border-b border-[color:var(--border)] px-3 py-1.5">
      <div className="diff-turn-strip flex min-w-0 flex-1 gap-1 overflow-x-auto py-0.5">
        <button
          type="button"
          className={cn(
            diffPanelTurnChipBaseClass,
            selectedTurnCount === null
              ? diffPanelTurnChipSelectedClass
              : diffPanelTurnChipUnselectedClass,
          )}
          onClick={() => onSelectTurn(null)}
        >
          <div className="text-[10px] leading-tight font-medium">All turns</div>
        </button>
        {orderedTurnDiffSummaries.map((summary) => (
          <button
            key={summary.checkpointTurnCount}
            type="button"
            className={cn(
              diffPanelTurnChipBaseClass,
              summary.checkpointTurnCount === selectedTurnCount
                ? diffPanelTurnChipSelectedClass
                : diffPanelTurnChipUnselectedClass,
            )}
            onClick={() => onSelectTurn(summary.checkpointTurnCount)}
          >
            <div className="flex items-center gap-1">
              <span className="text-[10px] leading-tight font-medium">
                Turn {summary.checkpointTurnCount}
              </span>
              <span className="text-[9px] leading-tight opacity-70">
                {formatTurnChipTimestamp(summary.completedAt)}
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-1">
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
        <button
          type="button"
          className={cn(diffPanelIconButtonClass, "border-[color:var(--border)] bg-transparent")}
          onClick={onClose}
          aria-label="Close diff panel"
          title="Close diff panel"
        >
          <PanelRightClose size={14} />
        </button>
      </div>
    </div>
  );
}
