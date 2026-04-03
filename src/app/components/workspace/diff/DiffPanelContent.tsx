import { FileDiff, type FileDiffMetadata, Virtualizer } from "@pierre/diffs/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DesktopAction } from "../../../desktop/actions";
import type { ThreadData } from "../../../desktop/types";
import { useDesktopDiff } from "../../../hooks/useDesktopDiff";
import { cn } from "../../../utils/cn";
import { DiffPanelEmptyState } from "./DiffPanelEmptyState";
import { DiffPanelToolbar } from "./DiffPanelToolbar";
import {
  DIFF_PANEL_UNSAFE_CSS,
  buildFileDiffRenderKey,
  getRenderablePatch,
  joinProjectFilePath,
  orderRenderableFiles,
  orderTurnDiffSummaries,
  resolveFileDiffPath,
} from "./diff-panel-content.helpers";
import { resolveDiffThemeName } from "./diff-rendering";

type DiffRenderMode = "stacked" | "split";
type DiffThemeType = "light" | "dark";

type DiffPanelContentProps = {
  projectId: string;
  threadData: ThreadData | null;
  isGitRepo: boolean;
  selectedTurnCount: number | null;
  selectedFilePath: string | null;
  onSelectTurn: (checkpointTurnCount: number | null) => void;
  layoutMode?: "split" | "overlay";
  onClose: () => void;
  onAction: (action: DesktopAction, payload?: Record<string, unknown>) => void;
};

export function DiffPanelContent({
  projectId,
  threadData,
  isGitRepo,
  selectedTurnCount,
  selectedFilePath,
  onSelectTurn,
  layoutMode = "split",
  onClose,
  onAction,
}: DiffPanelContentProps) {
  const [diffRenderMode, setDiffRenderMode] = useState<DiffRenderMode>("stacked");
  const patchViewportRef = useRef<HTMLDivElement>(null);
  const orderedTurnDiffSummaries = useMemo(
    () => orderTurnDiffSummaries(threadData?.turnDiffSummaries ?? []),
    [threadData?.turnDiffSummaries],
  );
  const { diff, isLoading, error } = useDesktopDiff(
    threadData?.sessionPath ?? null,
    selectedTurnCount,
    Boolean(threadData && isGitRepo && orderedTurnDiffSummaries.length > 0),
  );

  const selectedPatch = diff?.diff;
  const hasResolvedPatch = typeof selectedPatch === "string";
  const hasNoNetChanges = hasResolvedPatch && selectedPatch.trim().length === 0;
  const renderablePatch = useMemo(
    () => getRenderablePatch(selectedPatch, "diff-panel:dark"),
    [selectedPatch],
  );
  const renderableFiles = useMemo(
    () =>
      renderablePatch && renderablePatch.kind === "files"
        ? orderRenderableFiles(renderablePatch.files)
        : [],
    [renderablePatch],
  );

  useEffect(() => {
    void diff?.toTurnCount;

    if (!selectedFilePath || !patchViewportRef.current) {
      return;
    }

    const target = Array.from(
      patchViewportRef.current.querySelectorAll<HTMLElement>("[data-diff-file-path]"),
    ).find((element) => element.dataset.diffFilePath === selectedFilePath);
    target?.scrollIntoView({ block: "nearest" });
  }, [diff?.toTurnCount, selectedFilePath]);

  return (
    <aside
      className={cn(
        "grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-[color:var(--workspace)]",
        layoutMode === "split" && "border-l border-[color:var(--border)] xl:w-full",
      )}
      data-feature-id="feature:diff.panel"
      data-feature-status="partial"
    >
      {!threadData ? (
        <DiffPanelEmptyState message="Select a thread to inspect turn diffs." />
      ) : !isGitRepo ? (
        <DiffPanelEmptyState message="Turn diffs are unavailable because this project is not a git repository." />
      ) : orderedTurnDiffSummaries.length === 0 ? (
        <DiffPanelEmptyState message="No completed turns yet." />
      ) : (
        <>
          <DiffPanelToolbar
            diffRenderMode={diffRenderMode}
            orderedTurnDiffSummaries={orderedTurnDiffSummaries}
            selectedTurnCount={selectedTurnCount}
            onClose={onClose}
            onAction={onAction}
            onSelectTurn={onSelectTurn}
            onSetDiffRenderMode={setDiffRenderMode}
          />

          <div ref={patchViewportRef} className="min-h-0 min-w-0 flex-1 overflow-hidden">
            {error && !renderablePatch ? (
              <div className="px-3 pt-3">
                <p className="mb-2 text-[11px] text-[#f2a7a7]">{error}</p>
              </div>
            ) : null}

            {!renderablePatch ? (
              <div className="flex h-full items-center justify-center px-3 py-2 text-center text-xs text-[color:var(--muted)]">
                <p>
                  {isLoading
                    ? "Loading checkpoint diff..."
                    : hasNoNetChanges
                      ? "No net changes in this selection."
                      : "No patch available for this selection."}
                </p>
              </div>
            ) : renderablePatch.kind === "files" ? (
              <Virtualizer
                className="h-full min-h-0 overflow-auto"
                config={{
                  overscrollSize: 600,
                  intersectionObserverMargin: 1200,
                }}
              >
                {renderableFiles.map((fileDiff: FileDiffMetadata) => {
                  const filePath = resolveFileDiffPath(fileDiff);
                  const fileKey = buildFileDiffRenderKey(fileDiff);
                  return (
                    <div
                      key={`${fileKey}:dark`}
                      data-diff-file-path={filePath}
                      className="first:mt-0"
                      onClickCapture={(event) => {
                        const nativeEvent = event.nativeEvent as MouseEvent;
                        const composedPath = nativeEvent.composedPath?.() ?? [];
                        const clickedHeader = composedPath.some((node) => {
                          if (!(node instanceof Element)) return false;
                          return node.hasAttribute("data-title");
                        });
                        if (!clickedHeader) return;

                        const openPathPromise = window.piDesktop?.openPath?.(
                          joinProjectFilePath(projectId, filePath),
                        );
                        void openPathPromise?.catch(() => undefined);
                      }}
                    >
                      <FileDiff
                        fileDiff={fileDiff}
                        options={{
                          diffStyle: diffRenderMode === "split" ? "split" : "unified",
                          lineDiffType: "none",
                          theme: resolveDiffThemeName("dark"),
                          themeType: "dark" as DiffThemeType,
                          unsafeCSS: DIFF_PANEL_UNSAFE_CSS,
                        }}
                      />
                    </div>
                  );
                })}
              </Virtualizer>
            ) : (
              <div className="h-full overflow-auto p-3">
                <div className="space-y-2">
                  <p className="text-[11px] text-[color:var(--muted)]">{renderablePatch.reason}</p>
                  <pre className="max-h-[70vh] overflow-auto rounded-xl border border-[color:var(--border)] bg-[rgba(18,20,28,0.7)] p-3 font-mono text-[11px] leading-relaxed text-[color:var(--text)]/90">
                    {renderablePatch.text}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
