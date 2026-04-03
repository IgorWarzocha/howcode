import type { TimelineRow } from "./timeline-row";

type FoldableRow = Extract<TimelineRow, { kind: "turn" | "summary" }>;

type ReconcileCollapsedRowIdsOptions = {
  defaultExpandedRowId?: string | null;
  forcedExpandedRowId?: string | null;
};

export function reconcileCollapsedRowIds(
  foldableRows: FoldableRow[],
  current: Record<string, boolean>,
  options?: ReconcileCollapsedRowIdsOptions,
) {
  const next: Record<string, boolean> = {};
  const defaultExpandedRowId = options?.defaultExpandedRowId ?? null;
  const forcedExpandedRowId = options?.forcedExpandedRowId ?? null;

  for (const row of foldableRows) {
    if (row.id === forcedExpandedRowId) {
      next[row.id] = false;
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(current, row.id)) {
      next[row.id] = current[row.id] as boolean;
      continue;
    }

    next[row.id] = row.id !== defaultExpandedRowId;
  }

  return next;
}
