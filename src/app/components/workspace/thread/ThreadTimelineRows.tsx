import type { VirtualItem } from "@tanstack/react-virtual";
import type { ReactNode, Ref } from "react";
import type { TimelineRow } from "./timeline-row";

type ThreadTimelineRowsProps = {
  rows: TimelineRow[];
  totalSize: number;
  virtualRows: VirtualItem[];
  nonVirtualizedRows: TimelineRow[];
  measureElement: Ref<HTMLDivElement>;
  renderRow: (row: TimelineRow) => ReactNode;
};

export function ThreadTimelineRows({
  rows,
  totalSize,
  virtualRows,
  nonVirtualizedRows,
  measureElement,
  renderRow,
}: ThreadTimelineRowsProps) {
  return (
    <>
      {virtualRows.length > 0 ? (
        <div className="relative min-w-0" style={{ height: `${totalSize}px` }}>
          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index];
            if (!row) {
              return null;
            }

            return (
              <div
                key={`virtual-row:${virtualRow.key}`}
                data-index={virtualRow.index}
                ref={measureElement}
                className="absolute left-0 top-0 w-full min-w-0"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                {renderRow(row)}
              </div>
            );
          })}
        </div>
      ) : null}

      {nonVirtualizedRows.map((row) => (
        <div key={`tail-row:${row.id}`} className="min-w-0">
          {renderRow(row)}
        </div>
      ))}
    </>
  );
}
