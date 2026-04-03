import type { TurnDiffSummary } from "../../../desktop/types";
import { ChangedFilesTree } from "../diff/ChangedFilesTree";

type ThreadInlineDiffCardProps = {
  turnSummary: TurnDiffSummary;
  allDirectoriesExpanded: boolean;
  onToggleExpanded: () => void;
  onOpenTurnDiff: (checkpointTurnCount: number, filePath?: string) => void;
};

export function ThreadInlineDiffCard({
  turnSummary,
  allDirectoriesExpanded,
  onToggleExpanded,
  onOpenTurnDiff,
}: ThreadInlineDiffCardProps) {
  return (
    <div className="px-4">
      <div className="rounded-2xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.025)] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-[11px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
            Changed files ({turnSummary.files.length}) · turn {turnSummary.checkpointTurnCount}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-[color:var(--border)] px-2 py-1 text-[11px] text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)]"
              onClick={onToggleExpanded}
            >
              {allDirectoriesExpanded ? "Collapse all" : "Expand all"}
            </button>
            <button
              type="button"
              className="rounded-lg border border-[color:var(--border)] px-2 py-1 text-[11px] text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)]"
              onClick={() =>
                onOpenTurnDiff(turnSummary.checkpointTurnCount, turnSummary.files[0]?.path)
              }
            >
              View diff
            </button>
          </div>
        </div>
        <ChangedFilesTree
          checkpointTurnCount={turnSummary.checkpointTurnCount}
          files={turnSummary.files}
          allDirectoriesExpanded={allDirectoriesExpanded}
          onOpenTurnDiff={onOpenTurnDiff}
        />
      </div>
    </div>
  );
}
