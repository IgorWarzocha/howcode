import type { DiffLineAnnotation, FileDiffMetadata } from "@pierre/diffs/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getFeatureStatusDataAttributes } from "../../../features/feature-status";
import { useDesktopDiff } from "../../../hooks/useDesktopDiff";
import { cn } from "../../../utils/cn";
import { DiffCommentAnnotationCard } from "./DiffCommentAnnotationCard";
import { DiffPanelEmptyState } from "./DiffPanelEmptyState";
import { DiffPanelFileList } from "./DiffPanelFileList";
import {
  DIFF_FILE_ESTIMATED_FILE_GAP,
  DIFF_FILE_ESTIMATED_HEADER_HEIGHT,
  type DiffCommentMetadata,
  buildFileDiffRenderKey,
  estimateFileDiffHeight,
  getRenderablePatch,
  orderRenderableFiles,
} from "./diff-panel-content.helpers";
import { useDiffCommentDrafting } from "./useDiffCommentDrafting";
import { useDiffPanelCommentState } from "./useDiffPanelCommentState";
import { useDiffPanelScrollAlignment } from "./useDiffPanelScrollAlignment";

type DiffPanelContentProps = {
  projectId: string;
  isGitRepo: boolean;
  selectedFilePath: string | null;
  selectedCommentId: string | null;
  selectedCommentJumpKey: number;
  diffRenderMode: "stacked" | "split";
  layoutMode?: "split" | "overlay" | "main";
};

export function DiffPanelContent({
  projectId,
  isGitRepo,
  selectedFilePath,
  selectedCommentId,
  selectedCommentJumpKey,
  diffRenderMode,
  layoutMode = "split",
}: DiffPanelContentProps) {
  const [collapsedFiles, setCollapsedFiles] = useState<Record<string, boolean>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const draftCardRef = useRef<HTMLDivElement | null>(null);
  const { diff, isLoading, error } = useDesktopDiff(projectId, isGitRepo);

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
  const {
    annotationCountByFile,
    commentAnnotationsByFile,
    draftComment,
    draftSelectedLines,
    draftTarget,
    hasCommentContext,
    persistDraftComment,
    removeComment,
    savedComments,
    setDraftComment,
  } = useDiffPanelCommentState({ projectId });

  const {
    clearDragSelection,
    getFileInteractionHandlers,
    getSelectedLinesForFile,
    handleFilePointerDownCapture,
    openDraftComment,
  } = useDiffCommentDrafting({
    draftComment,
    setDraftComment,
  });

  useEffect(() => {
    if (!hasCommentContext) {
      clearDragSelection();
    }
  }, [clearDragSelection, hasCommentContext]);

  const estimatedFileHeights = useMemo(
    () =>
      renderableFiles.map((fileDiff) => {
        const fileKey = buildFileDiffRenderKey(fileDiff);
        return estimateFileDiffHeight({
          fileDiff,
          collapsed: collapsedFiles[fileKey] === true,
          diffRenderMode,
          annotationCount: annotationCountByFile.get(fileKey) ?? 0,
        });
      }),
    [annotationCountByFile, collapsedFiles, diffRenderMode, renderableFiles],
  );

  const getVirtualItemKey = useCallback(
    (index: number) => buildFileDiffRenderKey(renderableFiles[index] as FileDiffMetadata),
    [renderableFiles],
  );

  const fileListVirtualizer = useVirtualizer({
    count: renderableFiles.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: (index) =>
      estimatedFileHeights[index] ??
      DIFF_FILE_ESTIMATED_HEADER_HEIGHT + DIFF_FILE_ESTIMATED_FILE_GAP,
    getItemKey: getVirtualItemKey,
    overscan: 3,
    useAnimationFrameWithResizeObserver: true,
  });

  const toggleFileCollapsed = useCallback((fileKey: string) => {
    setCollapsedFiles((current) => ({
      ...current,
      [fileKey]: !current[fileKey],
    }));
  }, []);

  const renderCommentAnnotation = (annotation: DiffLineAnnotation<DiffCommentMetadata>) => (
    <DiffCommentAnnotationCard
      annotation={annotation}
      draftCardRef={draftCardRef}
      draftComment={draftComment}
      setDraftComment={setDraftComment}
      onPersistDraftComment={persistDraftComment}
      onRemoveComment={removeComment}
    />
  );

  useDiffPanelScrollAlignment({
    collapsedFiles,
    draftCardRef,
    draftTarget,
    fileListVirtualizer,
    renderableFiles,
    savedComments,
    scrollContainerRef,
    selectedCommentId,
    selectedCommentJumpKey,
    selectedFilePath,
    setCollapsedFiles,
  });

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-[20px] bg-[color:var(--workspace)]",
        layoutMode === "split" && "border-l border-[color:var(--border)] xl:w-full",
      )}
      {...getFeatureStatusDataAttributes("feature:diff.panel")}
    >
      {!isGitRepo ? (
        <DiffPanelEmptyState message="Diffs are unavailable because this project is not a git repository." />
      ) : (
        <>
          <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
            {error && !renderablePatch ? (
              <div className="px-3 pt-3">
                <p className="mb-2 text-[11px] text-[#f2a7a7]">{error}</p>
              </div>
            ) : null}

            {!renderablePatch ? (
              <div className="flex h-full items-center justify-center px-3 py-2 text-center text-xs text-[color:var(--muted)]">
                <p>
                  {isLoading
                    ? "Loading diff..."
                    : hasNoNetChanges
                      ? "No net changes in this worktree."
                      : "No patch available for this worktree."}
                </p>
              </div>
            ) : renderablePatch.kind === "files" ? (
              <div
                ref={scrollContainerRef}
                className="h-full min-h-0 overflow-auto [overflow-anchor:none]"
              >
                <DiffPanelFileList
                  collapsedFiles={collapsedFiles}
                  commentAnnotationsByFile={commentAnnotationsByFile}
                  diffRenderMode={diffRenderMode}
                  draftSelectedLines={draftSelectedLines}
                  getFileInteractionHandlers={getFileInteractionHandlers}
                  getSelectedLinesForFile={getSelectedLinesForFile}
                  handleFilePointerDownCapture={handleFilePointerDownCapture}
                  measureElement={fileListVirtualizer.measureElement}
                  onOpenDraftComment={openDraftComment}
                  onToggleFileCollapsed={toggleFileCollapsed}
                  projectId={projectId}
                  renderCommentAnnotation={renderCommentAnnotation}
                  renderableFiles={renderableFiles}
                  totalSize={fileListVirtualizer.getTotalSize()}
                  virtualItems={fileListVirtualizer.getVirtualItems()}
                />
              </div>
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
