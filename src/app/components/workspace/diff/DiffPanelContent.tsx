import type { DiffLineAnnotation, FileDiffMetadata } from "@pierre/diffs/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProjectDiffBaseline } from "../../../desktop/types";
import { getFeatureStatusDataAttributes } from "../../../features/feature-status";
import { useDesktopDiff } from "../../../hooks/useDesktopDiff";
import { cn } from "../../../utils/cn";
import { getDiffBaselinePrefix, getResolvedDiffBaselineLabel } from "../composer/diff-baseline";
import { DiffCommentAnnotationCard } from "./DiffCommentAnnotationCard";
import { DiffPanelEmptyState } from "./DiffPanelEmptyState";
import { DiffChangedFilesTree } from "./DiffChangedFilesTree";
import { DiffPanelFileList } from "./DiffPanelFileList";
import {
  DIFF_FILE_ESTIMATED_FILE_GAP,
  DIFF_FILE_ESTIMATED_HEADER_HEIGHT,
  type DiffCommentMetadata,
  buildFileDiffRenderKey,
  estimateFileDiffHeight,
  getRenderablePatch,
  orderRenderableFiles,
  resolveFileDiffPath,
} from "./diff-panel-content.helpers";
import { useDiffCommentDrafting } from "./useDiffCommentDrafting";
import { useDiffPanelCommentState } from "./useDiffPanelCommentState";
import { useDiffPanelScrollAlignment } from "./useDiffPanelScrollAlignment";

type DiffPanelContentProps = {
  projectId: string;
  isGitRepo: boolean;
  baseline: ProjectDiffBaseline | null;
  selectedFilePath: string | null;
  selectedCommentId: string | null;
  selectedCommentJumpKey: number;
  diffRenderMode: "stacked" | "split";
  layoutMode?: "split" | "overlay" | "main";
  showFileTree?: boolean;
};

export function DiffPanelContent({
  projectId,
  isGitRepo,
  baseline,
  selectedFilePath,
  selectedCommentId,
  selectedCommentJumpKey,
  diffRenderMode,
  layoutMode = "split",
  showFileTree = true,
}: DiffPanelContentProps) {
  const [collapsedFiles, setCollapsedFiles] = useState<Record<string, boolean>>({});
  const [focusedFilePaths, setFocusedFilePaths] = useState<readonly string[]>([]);
  const [renderFileTree, setRenderFileTree] = useState(showFileTree);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const draftCardRef = useRef<HTMLDivElement | null>(null);
  const { diff, isLoading, error } = useDesktopDiff(projectId, baseline, isGitRepo);

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
  const normalizedFocusedFilePaths = useMemo(
    () => focusedFilePaths.map((filePath) => filePath.replace(/\/+$/, "")),
    [focusedFilePaths],
  );
  const selectedFilePathSet = useMemo(
    () => new Set(normalizedFocusedFilePaths),
    [normalizedFocusedFilePaths],
  );
  const hasFocusedFiles = showFileTree && normalizedFocusedFilePaths.length > 0;
  const visibleRenderableFiles = useMemo(() => {
    if (!hasFocusedFiles) {
      return renderableFiles;
    }

    const isVisiblePath = (filePath: string) =>
      selectedFilePathSet.has(filePath) ||
      normalizedFocusedFilePaths.some((selectedPath) => filePath.startsWith(`${selectedPath}/`));
    const selectedFileStillVisible = selectedFilePath ? isVisiblePath(selectedFilePath) : true;

    return renderableFiles.filter((fileDiff) => {
      const filePath = resolveFileDiffPath(fileDiff);
      return (
        isVisiblePath(filePath) || (!selectedFileStillVisible && filePath === selectedFilePath)
      );
    });
  }, [
    hasFocusedFiles,
    normalizedFocusedFilePaths,
    renderableFiles,
    selectedFilePath,
    selectedFilePathSet,
  ]);

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
    if (showFileTree) {
      setRenderFileTree(true);
      return;
    }

    setFocusedFilePaths([]);
    const timeout = window.setTimeout(() => setRenderFileTree(false), 200);
    return () => window.clearTimeout(timeout);
  }, [showFileTree]);

  useEffect(() => {
    if (!hasCommentContext) {
      clearDragSelection();
    }
  }, [clearDragSelection, hasCommentContext]);

  const estimatedFileHeights = useMemo(
    () =>
      visibleRenderableFiles.map((fileDiff) => {
        const fileKey = buildFileDiffRenderKey(fileDiff);
        return estimateFileDiffHeight({
          fileDiff,
          collapsed: collapsedFiles[fileKey] === true,
          diffRenderMode,
          annotationCount: annotationCountByFile.get(fileKey) ?? 0,
        });
      }),
    [annotationCountByFile, collapsedFiles, diffRenderMode, visibleRenderableFiles],
  );

  const getVirtualItemKey = useCallback(
    (index: number) => buildFileDiffRenderKey(visibleRenderableFiles[index] as FileDiffMetadata),
    [visibleRenderableFiles],
  );

  const fileListVirtualizer = useVirtualizer({
    count: visibleRenderableFiles.length,
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
    renderableFiles: visibleRenderableFiles,
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
            {!renderablePatch ? (
              <div className="flex h-full items-center justify-center px-3 py-2 text-center text-xs text-[color:var(--muted)]">
                <div className="grid max-w-[42rem] gap-1.5">
                  <p>
                    {isLoading
                      ? "Loading diff..."
                      : error
                        ? "Diff unavailable."
                        : hasNoNetChanges
                          ? `No net changes ${getDiffBaselinePrefix(baseline)} ${getResolvedDiffBaselineLabel(baseline, diff?.resolvedBaseline)}.`
                          : "No patch available for this worktree."}
                  </p>
                  {error ? <p className="text-[#f2a7a7]">{error}</p> : null}
                </div>
              </div>
            ) : renderablePatch.kind === "files" ? (
              <div className="flex h-full min-h-0">
                <div
                  ref={scrollContainerRef}
                  className="min-h-0 min-w-0 flex-1 overflow-auto [overflow-anchor:none]"
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
                    renderableFiles={visibleRenderableFiles}
                    totalSize={fileListVirtualizer.getTotalSize()}
                    virtualItems={fileListVirtualizer.getVirtualItems()}
                  />
                </div>
                <div
                  className="min-h-0 shrink-0 overflow-hidden transition-[width,opacity] duration-200 ease-out"
                  style={{
                    width: showFileTree ? "min(28rem, calc(100% - 2.5rem))" : 0,
                    opacity: showFileTree ? 1 : 0,
                  }}
                  aria-hidden={!showFileTree}
                >
                  {renderFileTree ? (
                    <DiffChangedFilesTree
                      files={renderableFiles}
                      selectedPaths={focusedFilePaths}
                      focusedFileCount={hasFocusedFiles ? visibleRenderableFiles.length : 0}
                      onSelectedPathsChange={setFocusedFilePaths}
                    />
                  ) : null}
                </div>
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
