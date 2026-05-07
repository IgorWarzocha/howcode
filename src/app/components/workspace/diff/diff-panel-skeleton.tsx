import { SkeletonBlock } from '../../common/skeleton'

export function DiffPanelSkeleton({ showFileTree = true }: { showFileTree?: boolean }) {
  return (
    <div className="flex h-full min-h-0" role="status" aria-label="Loading diff" aria-busy="true">
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden px-3 py-3">
        <div className="grid gap-3">
          {Array.from({ length: 4 }, (_, index) => {
            const rowId = `diff-file-${index}`
            return (
              <div
                key={rowId}
                className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.018)]"
              >
                <div className="flex h-9 items-center justify-between gap-3 border-b border-[color:var(--border)] px-3">
                  <SkeletonBlock className="h-3.5 w-[min(18rem,58%)] rounded-md" />
                  <SkeletonBlock className="h-3 w-16 rounded-md opacity-60" />
                </div>
                <div className="grid gap-2 px-3 py-3">
                  {Array.from(
                    { length: index === 0 ? 8 : 5 },
                    (_unusedLineValue, skeletonLineIndex) => {
                      const lineId = `${rowId}-line-${skeletonLineIndex}`
                      return (
                        <div key={lineId} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3">
                          <SkeletonBlock className="h-3 w-8 rounded-md opacity-45" />
                          <SkeletonBlock
                            className="h-3 rounded-md opacity-65"
                            style={{
                              width: `${skeletonLineIndex % 3 === 0 ? 72 : skeletonLineIndex % 3 === 1 ? 88 : 54}%`,
                            }}
                          />
                        </div>
                      )
                    },
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {showFileTree ? (
        <div
          className="min-h-0 shrink-0 border-l border-[color:var(--border)] px-2.5 py-3"
          style={{ width: 'min(28rem, calc(100% - 2.5rem))' }}
        >
          <div className="mb-3 flex h-7 items-center justify-between gap-3 px-2.5">
            <SkeletonBlock className="h-3.5 w-20 rounded-md" />
            <SkeletonBlock className="h-3 w-16 rounded-md opacity-60" />
          </div>
          <SkeletonBlock className="mb-3 h-8 w-full rounded-[10px] opacity-65" />
          <div className="grid gap-2 px-1">
            {Array.from({ length: 10 }, (_, index) => {
              const rowId = `diff-tree-${index}`
              return (
                <div
                  key={rowId}
                  className="grid grid-cols-[14px_minmax(0,1fr)_42px] items-center gap-2"
                >
                  <SkeletonBlock className="h-3 w-3 rounded-sm opacity-55" />
                  <SkeletonBlock
                    className="h-3 rounded-md"
                    style={{
                      width: `${index % 4 === 0 ? 86 : index % 4 === 1 ? 62 : index % 4 === 2 ? 74 : 48}%`,
                    }}
                  />
                  <SkeletonBlock className="h-3 w-9 rounded-md opacity-50" />
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
