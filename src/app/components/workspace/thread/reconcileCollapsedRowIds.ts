import type { TimelineRow } from "./timeline-row";

type FoldableRow = Extract<TimelineRow, { kind: "turn" | "summary" }>;

export function reconcileCollapsedRowIds(
  foldableRows: FoldableRow[],
  current: Record<string, boolean>,
) {
  const next: Record<string, boolean> = {};
  const lastFoldableRowId = foldableRows[foldableRows.length - 1]?.id ?? null;

  for (const row of foldableRows) {
    next[row.id] = row.id === lastFoldableRowId ? false : (current[row.id] ?? true);
  }

  return next;
}
