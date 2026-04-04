import type { GetHoveredLineResult, SelectedLineRange } from "@pierre/diffs";
import {
  type AnnotationSide,
  type DiffLineAnnotation,
  FileDiff,
  type FileDiffMetadata,
} from "@pierre/diffs/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Check, ChevronDown, ChevronRight, MessageSquarePlus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDesktopDiff } from "../../../hooks/useDesktopDiff";
import { cn } from "../../../utils/cn";
import { DiffPanelEmptyState } from "./DiffPanelEmptyState";
import {
  DIFF_PANEL_UNSAFE_CSS,
  buildFileDiffRenderKey,
  getRenderablePatch,
  joinProjectFilePath,
  orderRenderableFiles,
  resolveFileDiffPath,
} from "./diff-panel-content.helpers";
import { resolveDiffThemeName } from "./diff-rendering";
import {
  type DiffCommentDraft,
  type SavedDiffComment,
  diffCommentStore,
  getDiffCommentContextId,
} from "./diffCommentStore";

type DiffThemeType = "light" | "dark";

type DiffCommentMetadata = {
  id: string;
  body: string;
  kind: "comment" | "draft";
  side: AnnotationSide;
  lineNumber: number;
  endSide?: AnnotationSide;
  endLineNumber?: number;
};

function isSameDraftTarget(
  left: Pick<DiffCommentDraft, "fileKey" | "side" | "lineNumber" | "endSide" | "endLineNumber">,
  right: Pick<DiffCommentDraft, "fileKey" | "side" | "lineNumber" | "endSide" | "endLineNumber">,
) {
  return (
    left.fileKey === right.fileKey &&
    left.side === right.side &&
    left.lineNumber === right.lineNumber &&
    (left.endSide ?? left.side) === (right.endSide ?? right.side) &&
    (left.endLineNumber ?? left.lineNumber) === (right.endLineNumber ?? right.lineNumber)
  );
}

function buildDraftTarget({
  fileKey,
  filePath,
  side,
  lineNumber,
  endSide,
  endLineNumber,
}: {
  fileKey: string;
  filePath: string;
  side: AnnotationSide;
  lineNumber: number;
  endSide?: AnnotationSide;
  endLineNumber?: number;
}): Omit<DiffCommentDraft, "body"> {
  const resolvedEndSide = endSide ?? side;
  const resolvedEndLineNumber = endLineNumber ?? lineNumber;

  return {
    fileKey,
    filePath,
    side,
    lineNumber,
    ...(resolvedEndSide !== side ? { endSide: resolvedEndSide } : {}),
    ...(resolvedEndLineNumber !== lineNumber ? { endLineNumber: resolvedEndLineNumber } : {}),
  };
}

function describeCommentTarget({
  side,
  lineNumber,
  endSide,
  endLineNumber,
}: Pick<DiffCommentDraft, "side" | "lineNumber" | "endSide" | "endLineNumber">) {
  const resolvedEndSide = endSide ?? side;
  const resolvedEndLineNumber = endLineNumber ?? lineNumber;
  const sideLabel = side === "deletions" ? "Old" : "New";

  if (side === resolvedEndSide) {
    const start = Math.min(lineNumber, resolvedEndLineNumber);
    const end = Math.max(lineNumber, resolvedEndLineNumber);
    return start === end ? `${sideLabel} line ${start}` : `${sideLabel} lines ${start}-${end}`;
  }

  const endSideLabel = resolvedEndSide === "deletions" ? "Old" : "New";
  return `${sideLabel} line ${lineNumber} → ${endSideLabel} line ${resolvedEndLineNumber}`;
}

function describeCollapsedLines(count: number) {
  return `${count} unmodified line${count === 1 ? "" : "s"}`;
}

function getFileHeaderContextLabel(fileDiff: FileDiffMetadata) {
  const collapsedBefore = fileDiff.hunks[0]?.collapsedBefore ?? 0;
  return collapsedBefore > 0 ? describeCollapsedLines(collapsedBefore) : null;
}

function getFileChangeCounts(fileDiff: FileDiffMetadata) {
  let additions = 0;
  let deletions = 0;

  for (const hunk of fileDiff.hunks) {
    additions += hunk.additionLines;
    deletions += hunk.deletionLines;
  }

  return { additions, deletions };
}

const DIFF_FILE_ESTIMATED_LINE_HEIGHT = 20;
const DIFF_FILE_ESTIMATED_HEADER_HEIGHT = 36;
const DIFF_FILE_ESTIMATED_FILE_GAP = 8;
const DIFF_FILE_ESTIMATED_SEPARATOR_HEIGHT = 32;
const DIFF_FILE_ESTIMATED_COMMENT_HEIGHT = 92;

function estimateFileDiffHeight({
  fileDiff,
  collapsed,
  diffRenderMode,
  annotationCount,
}: {
  fileDiff: FileDiffMetadata;
  collapsed: boolean;
  diffRenderMode: "stacked" | "split";
  annotationCount: number;
}) {
  let height = DIFF_FILE_ESTIMATED_HEADER_HEIGHT;

  if (!collapsed) {
    let lineCount = 0;
    let separatorCount = 0;

    for (const hunk of fileDiff.hunks) {
      lineCount += diffRenderMode === "split" ? hunk.splitLineCount : hunk.unifiedLineCount;

      if (hunk.collapsedBefore > 0) {
        separatorCount += 1;
      }
    }

    height += lineCount * DIFF_FILE_ESTIMATED_LINE_HEIGHT;
    height +=
      separatorCount * (DIFF_FILE_ESTIMATED_SEPARATOR_HEIGHT + DIFF_FILE_ESTIMATED_FILE_GAP);

    if (fileDiff.hunks.length > 0) {
      height += DIFF_FILE_ESTIMATED_FILE_GAP;
    }
  }

  if (annotationCount > 0) {
    height += annotationCount * DIFF_FILE_ESTIMATED_COMMENT_HEIGHT;
  }

  return Math.max(height, DIFF_FILE_ESTIMATED_HEADER_HEIGHT + DIFF_FILE_ESTIMATED_FILE_GAP);
}

function resolvePointerLineTarget(event: MouseEvent | PointerEvent): {
  side: AnnotationSide;
  lineNumber: number;
} | null {
  const path = event.composedPath?.() ?? [];
  let numberElement: HTMLElement | null = null;
  let codeElement: HTMLElement | null = null;
  let lineType: string | null = null;
  let lineNumber: number | null = null;

  for (const node of path) {
    if (!(node instanceof HTMLElement)) {
      continue;
    }

    if (
      node instanceof HTMLButtonElement ||
      node instanceof HTMLTextAreaElement ||
      node instanceof HTMLInputElement ||
      node instanceof HTMLSelectElement
    ) {
      return null;
    }

    if (node.hasAttribute("data-title") || node.hasAttribute("data-file-info")) {
      return null;
    }

    if (!numberElement) {
      const columnNumber = node.getAttribute("data-column-number");
      if (columnNumber) {
        const parsedLineNumber = Number.parseInt(columnNumber, 10);
        if (!Number.isNaN(parsedLineNumber)) {
          numberElement = node;
          lineNumber = parsedLineNumber;
          lineType = node.getAttribute("data-line-type");
          continue;
        }
      }
    }

    if (lineNumber == null) {
      const lineAttribute = node.getAttribute("data-line");
      if (lineAttribute) {
        const parsedLineNumber = Number.parseInt(lineAttribute, 10);
        if (!Number.isNaN(parsedLineNumber)) {
          lineNumber = parsedLineNumber;
          lineType = node.getAttribute("data-line-type");
          continue;
        }
      }
    }

    if (!codeElement && node.hasAttribute("data-code")) {
      codeElement = node;
      break;
    }
  }

  if (!codeElement || lineNumber == null) {
    return null;
  }

  const side: AnnotationSide =
    lineType === "change-deletion"
      ? "deletions"
      : lineType === "change-addition"
        ? "additions"
        : codeElement.hasAttribute("data-deletions")
          ? "deletions"
          : "additions";

  return { side, lineNumber };
}

type DiffPanelContentProps = {
  projectId: string;
  isGitRepo: boolean;
  selectedFilePath: string | null;
  diffRenderMode: "stacked" | "split";
  layoutMode?: "split" | "overlay" | "main";
};

export function DiffPanelContent({
  projectId,
  isGitRepo,
  selectedFilePath: _selectedFilePath,
  diffRenderMode,
  layoutMode = "split",
}: DiffPanelContentProps) {
  const [savedComments, setSavedComments] = useState<SavedDiffComment[]>([]);
  const [draftComment, setDraftComment] = useState<DiffCommentDraft | null>(null);
  const [dragSelectionRange, setDragSelectionRange] = useState<SelectedLineRange | null>(null);
  const [collapsedFiles, setCollapsedFiles] = useState<Record<string, boolean>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const draftCardRef = useRef<HTMLDivElement | null>(null);
  const fileInteractionHandlersRef = useRef(
    new Map<
      string,
      {
        onLineClick: ({
          lineNumber,
          annotationSide,
          event,
        }: {
          lineNumber: number;
          annotationSide: AnnotationSide;
          event: PointerEvent;
        }) => void;
        onLineNumberClick: ({
          lineNumber,
          annotationSide,
          event,
        }: {
          lineNumber: number;
          annotationSide: AnnotationSide;
          event: PointerEvent;
        }) => void;
      }
    >(),
  );
  const dragSelectionRef = useRef<{
    pointerId: number;
    fileKey: string;
    filePath: string;
    anchor: { side: AnnotationSide; lineNumber: number };
    current: { side: AnnotationSide; lineNumber: number };
    didDrag: boolean;
  } | null>(null);
  const dragUserSelectResetRef = useRef<(() => void) | null>(null);
  const suppressNextLineClickRef = useRef(false);
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
  const diffCommentContextId = useMemo(
    () =>
      getDiffCommentContextId({
        projectId,
      }),
    [projectId],
  );
  const draftFileKey = draftComment?.fileKey ?? null;
  const draftFilePath = draftComment?.filePath ?? null;
  const draftSide = draftComment?.side ?? null;
  const draftLineNumber = draftComment?.lineNumber ?? null;
  const draftEndSide = draftComment?.endSide;
  const draftEndLineNumber = draftComment?.endLineNumber;
  const draftTarget = useMemo(
    () =>
      draftFileKey && draftFilePath && draftSide && draftLineNumber !== null
        ? {
            fileKey: draftFileKey,
            filePath: draftFilePath,
            side: draftSide,
            lineNumber: draftLineNumber,
            endSide: draftEndSide,
            endLineNumber: draftEndLineNumber,
          }
        : null,
    [draftEndLineNumber, draftEndSide, draftFileKey, draftFilePath, draftLineNumber, draftSide],
  );
  const draftSelectedLines = useMemo<SelectedLineRange | null>(() => {
    if (!draftTarget) {
      return null;
    }

    return {
      start: draftTarget.lineNumber,
      end: draftTarget.endLineNumber ?? draftTarget.lineNumber,
      side: draftTarget.side,
      endSide: draftTarget.endSide ?? draftTarget.side,
    };
  }, [draftTarget]);

  useEffect(() => {
    if (!diffCommentContextId) {
      setSavedComments([]);
      setDraftComment(null);
      setDragSelectionRange(null);
      return;
    }

    const persistedContext = diffCommentStore.getContext(diffCommentContextId);
    setSavedComments(persistedContext?.comments ?? []);
    setDraftComment(persistedContext?.draft ?? null);
  }, [diffCommentContextId]);

  useEffect(() => {
    if (!diffCommentContextId) {
      return;
    }

    diffCommentStore.setContext(diffCommentContextId, {
      comments: savedComments,
      draft: draftComment,
    });
  }, [diffCommentContextId, draftComment, savedComments]);

  const commentAnnotationsByFile = useMemo(() => {
    const next = new Map<string, DiffLineAnnotation<DiffCommentMetadata>[]>();

    for (const comment of savedComments) {
      const entries = next.get(comment.fileKey) ?? [];
      entries.push({
        side: comment.side,
        lineNumber: comment.lineNumber,
        metadata: {
          id: comment.id,
          body: comment.body,
          kind: "comment",
          side: comment.side,
          lineNumber: comment.lineNumber,
          endSide: comment.endSide,
          endLineNumber: comment.endLineNumber,
        },
      });
      next.set(comment.fileKey, entries);
    }

    if (draftTarget) {
      const entries = next.get(draftTarget.fileKey) ?? [];
      entries.push({
        side: draftTarget.side,
        lineNumber: draftTarget.lineNumber,
        metadata: {
          id: `draft:${draftTarget.fileKey}:${draftTarget.side}:${draftTarget.lineNumber}`,
          body: "",
          kind: "draft",
          side: draftTarget.side,
          lineNumber: draftTarget.lineNumber,
          endSide: draftTarget.endSide,
          endLineNumber: draftTarget.endLineNumber,
        },
      });
      next.set(draftTarget.fileKey, entries);
    }

    return next;
  }, [draftTarget, savedComments]);

  const annotationCountByFile = useMemo(() => {
    const next = new Map<string, number>();

    for (const [fileKey, annotations] of commentAnnotationsByFile) {
      next.set(fileKey, annotations.length);
    }

    return next;
  }, [commentAnnotationsByFile]);

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

  const disableDocumentSelection = useCallback(() => {
    if (typeof document === "undefined") {
      return;
    }

    dragUserSelectResetRef.current?.();

    const htmlStyle = document.documentElement.style;
    const bodyStyle = document.body.style;
    const previousHtmlUserSelect = htmlStyle.userSelect;
    const previousBodyUserSelect = bodyStyle.userSelect;
    const previousHtmlWebkitUserSelect = htmlStyle.webkitUserSelect;
    const previousBodyWebkitUserSelect = bodyStyle.webkitUserSelect;

    htmlStyle.userSelect = "none";
    bodyStyle.userSelect = "none";
    htmlStyle.webkitUserSelect = "none";
    bodyStyle.webkitUserSelect = "none";

    dragUserSelectResetRef.current = () => {
      htmlStyle.userSelect = previousHtmlUserSelect;
      bodyStyle.userSelect = previousBodyUserSelect;
      htmlStyle.webkitUserSelect = previousHtmlWebkitUserSelect;
      bodyStyle.webkitUserSelect = previousBodyWebkitUserSelect;
      dragUserSelectResetRef.current = null;
    };
  }, []);

  const restoreDocumentSelection = useCallback(() => {
    dragUserSelectResetRef.current?.();
  }, []);

  const openDraftComment = useCallback(
    (
      fileKey: string,
      filePath: string,
      side: AnnotationSide,
      lineNumber: number,
      endSide?: AnnotationSide,
      endLineNumber?: number,
    ) => {
      const nextTarget = buildDraftTarget({
        fileKey,
        filePath,
        side,
        lineNumber,
        endSide,
        endLineNumber,
      });

      setDraftComment((current) => {
        if (current && isSameDraftTarget(current, nextTarget)) {
          return current;
        }

        return {
          ...nextTarget,
          body: "",
        };
      });
    },
    [],
  );

  const updateDragSelectionRange = useCallback(
    (
      side: AnnotationSide,
      lineNumber: number,
      endSide?: AnnotationSide,
      endLineNumber?: number,
    ) => {
      setDragSelectionRange({
        start: lineNumber,
        end: endLineNumber ?? lineNumber,
        side,
        endSide: endSide ?? side,
      });
    },
    [],
  );

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const dragSelection = dragSelectionRef.current;
      if (!dragSelection || dragSelection.pointerId !== event.pointerId) {
        return;
      }

      const target = resolvePointerLineTarget(event);
      if (!target) {
        return;
      }

      dragSelection.current = target;
      dragSelection.didDrag ||=
        target.side !== dragSelection.anchor.side ||
        target.lineNumber !== dragSelection.anchor.lineNumber;
      updateDragSelectionRange(
        dragSelection.anchor.side,
        dragSelection.anchor.lineNumber,
        target.side,
        target.lineNumber,
      );
    };

    const handlePointerEnd = (event: PointerEvent) => {
      const dragSelection = dragSelectionRef.current;
      if (!dragSelection || dragSelection.pointerId !== event.pointerId) {
        return;
      }

      const target = resolvePointerLineTarget(event) ?? dragSelection.current;
      if (target) {
        suppressNextLineClickRef.current = true;
        if (dragSelection.didDrag) {
          openDraftComment(
            dragSelection.fileKey,
            dragSelection.filePath,
            target.side,
            target.lineNumber,
            dragSelection.anchor.side,
            dragSelection.anchor.lineNumber,
          );
        } else {
          openDraftComment(
            dragSelection.fileKey,
            dragSelection.filePath,
            target.side,
            target.lineNumber,
          );
        }
      }

      dragSelectionRef.current = null;
      setDragSelectionRange(null);
      restoreDocumentSelection();
    };

    window.addEventListener("pointermove", handlePointerMove, true);
    window.addEventListener("pointerup", handlePointerEnd, true);
    window.addEventListener("pointercancel", handlePointerEnd, true);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("pointerup", handlePointerEnd, true);
      window.removeEventListener("pointercancel", handlePointerEnd, true);
      restoreDocumentSelection();
    };
  }, [openDraftComment, restoreDocumentSelection, updateDragSelectionRange]);

  const persistDraftComment = () => {
    const nextBody = draftComment?.body.trim() ?? "";
    if (!draftComment || nextBody.length === 0) {
      return;
    }

    setSavedComments((current) => [
      ...current,
      {
        ...draftComment,
        id: `${draftComment.fileKey}:${draftComment.side}:${draftComment.lineNumber}:${Date.now()}`,
        body: nextBody,
        createdAt: new Date().toISOString(),
      },
    ]);
    setDraftComment(null);
  };

  const removeComment = (commentId: string) => {
    setSavedComments((current) => current.filter((comment) => comment.id !== commentId));
  };

  const toggleFileCollapsed = useCallback((fileKey: string) => {
    setCollapsedFiles((current) => ({
      ...current,
      [fileKey]: !current[fileKey],
    }));
  }, []);

  const getFileInteractionHandlers = useCallback(
    (fileKey: string, filePath: string) => {
      const cached = fileInteractionHandlersRef.current.get(fileKey);
      if (cached) {
        return cached;
      }

      const next = {
        onLineClick: ({
          lineNumber,
          annotationSide,
          event,
        }: {
          lineNumber: number;
          annotationSide: AnnotationSide;
          event: PointerEvent;
        }) => {
          if (suppressNextLineClickRef.current) {
            suppressNextLineClickRef.current = false;
            event.preventDefault();
            return;
          }
          event.preventDefault();
          openDraftComment(fileKey, filePath, annotationSide, lineNumber);
        },
        onLineNumberClick: ({
          lineNumber,
          annotationSide,
          event,
        }: {
          lineNumber: number;
          annotationSide: AnnotationSide;
          event: PointerEvent;
        }) => {
          if (suppressNextLineClickRef.current) {
            suppressNextLineClickRef.current = false;
            event.preventDefault();
            return;
          }
          event.preventDefault();
          openDraftComment(fileKey, filePath, annotationSide, lineNumber);
        },
      };

      fileInteractionHandlersRef.current.set(fileKey, next);
      return next;
    },
    [openDraftComment],
  );

  const renderCommentAnnotation = (annotation: DiffLineAnnotation<DiffCommentMetadata>) => {
    const metadata = annotation.metadata;

    if (metadata.kind === "draft") {
      return (
        <div
          ref={draftCardRef}
          className="mx-3 mb-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--workspace)] px-3 py-2"
          style={{
            fontFamily:
              'var(--font-sans, "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif)',
          }}
        >
          <div className="mb-2 text-[11px] font-medium text-[color:var(--muted)]">
            Add comment · {draftComment ? describeCommentTarget(draftComment) : "Line comment"}
          </div>
          <textarea
            className="min-h-20 w-full resize-y rounded-lg border border-[color:var(--border)] bg-[color:var(--workspace)] px-3 py-2 text-[12px] leading-5 text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted)]"
            value={draftComment?.body ?? ""}
            onChange={(event) => {
              setDraftComment((current) =>
                current
                  ? {
                      ...current,
                      body: event.target.value,
                    }
                  : current,
              );
            }}
            placeholder="Leave a note on this diff"
            aria-label={`Comment for line ${annotation.lineNumber}`}
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--muted)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]"
              onClick={() => {
                setDraftComment(null);
              }}
              aria-label="Cancel comment"
              title="Cancel comment"
            >
              <X size={14} />
            </button>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[color:var(--accent)] text-[#1a1c26] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={persistDraftComment}
              disabled={(draftComment?.body.trim().length ?? 0) === 0}
              aria-label="Save comment"
              title="Save comment"
            >
              <Check size={14} />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        className="mx-3 mb-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--workspace)] px-3 py-2"
        style={{
          fontFamily:
            'var(--font-sans, "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif)',
        }}
      >
        <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-medium text-[color:var(--muted)]">
          <span>Comment · {describeCommentTarget(metadata)}</span>
          <button
            type="button"
            className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[color:var(--muted)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]"
            onClick={() => removeComment(metadata.id)}
            aria-label="Remove comment"
            title="Remove comment"
          >
            <X size={12} />
          </button>
        </div>
        <p className="m-0 whitespace-pre-wrap text-[12px] leading-5 text-[color:var(--text)]">
          {metadata.body}
        </p>
      </div>
    );
  };

  useEffect(() => {
    if (!draftTarget) {
      return;
    }

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const draftCard = draftCardRef.current;
      if (!draftCard) {
        return;
      }

      const containerRect = scrollContainer.getBoundingClientRect();
      const draftRect = draftCard.getBoundingClientRect();
      const desiredVisibleDraftHeight = Math.min(120, draftRect.height);
      const desiredDraftTop = containerRect.bottom - desiredVisibleDraftHeight;
      const bottomOverflow = draftRect.top - desiredDraftTop;
      const topOverflow = containerRect.top - draftRect.top;

      if (bottomOverflow > 0) {
        scrollContainer.scrollTop += bottomOverflow + 6;
        return;
      }

      if (topOverflow > 0) {
        scrollContainer.scrollTop -= topOverflow + 6;
      }
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [draftTarget]);

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-[20px] bg-[color:var(--workspace)]",
        layoutMode === "split" && "border-l border-[color:var(--border)] xl:w-full",
      )}
      data-feature-id="feature:diff.panel"
      data-feature-status="partial"
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
                <div
                  className="relative w-full"
                  style={{ height: fileListVirtualizer.getTotalSize() }}
                >
                  <div
                    style={{
                      transform: `translateY(${fileListVirtualizer.getVirtualItems()[0]?.start ?? 0}px)`,
                    }}
                  >
                    {fileListVirtualizer.getVirtualItems().map((virtualRow) => {
                      const fileDiff = renderableFiles[virtualRow.index] as FileDiffMetadata;
                      const filePath = resolveFileDiffPath(fileDiff);
                      const fileKey = buildFileDiffRenderKey(fileDiff);
                      const isCollapsed = collapsedFiles[fileKey] === true;
                      const fileInteractionHandlers = getFileInteractionHandlers(fileKey, filePath);
                      const selectedLines: SelectedLineRange | null =
                        dragSelectionRef.current?.fileKey === fileKey && dragSelectionRange
                          ? dragSelectionRange
                          : draftComment?.fileKey === fileKey
                            ? draftSelectedLines
                            : null;
                      return (
                        <div
                          key={virtualRow.key}
                          data-index={virtualRow.index}
                          data-diff-file-path={filePath}
                          className="first:mt-0"
                          ref={fileListVirtualizer.measureElement}
                          onPointerDownCapture={(event) => {
                            if (event.button !== 0) {
                              return;
                            }

                            const target = resolvePointerLineTarget(event.nativeEvent);
                            if (!target) {
                              return;
                            }

                            event.preventDefault();
                            dragSelectionRef.current = {
                              pointerId: event.pointerId,
                              fileKey,
                              filePath,
                              anchor: target,
                              current: target,
                              didDrag: false,
                            };
                            updateDragSelectionRange(target.side, target.lineNumber);
                            disableDocumentSelection();
                          }}
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
                          <FileDiff<DiffCommentMetadata>
                            fileDiff={fileDiff}
                            lineAnnotations={commentAnnotationsByFile.get(fileKey)}
                            selectedLines={selectedLines}
                            renderCustomHeader={(currentFileDiff) => {
                              const headerContextLabel = getFileHeaderContextLabel(currentFileDiff);
                              const { additions, deletions } = getFileChangeCounts(currentFileDiff);

                              return (
                                <button
                                  type="button"
                                  className="flex w-full items-center justify-between gap-3 bg-transparent px-3 py-2 text-left text-[color:var(--text)]"
                                  style={{
                                    fontFamily:
                                      'var(--font-sans, "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif)',
                                  }}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    toggleFileCollapsed(fileKey);
                                  }}
                                  aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${filePath}`}
                                  aria-expanded={!isCollapsed}
                                >
                                  <span className="flex min-w-0 items-center gap-2.5">
                                    <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-[color:var(--muted)]">
                                      {isCollapsed ? (
                                        <ChevronRight size={14} />
                                      ) : (
                                        <ChevronDown size={14} />
                                      )}
                                    </span>
                                    <span className="truncate text-[13px] font-medium text-[color:var(--text)]">
                                      {filePath}
                                    </span>
                                    {headerContextLabel ? (
                                      <span className="shrink-0 text-[12px] text-[color:var(--muted)]">
                                        {headerContextLabel}
                                      </span>
                                    ) : null}
                                  </span>
                                  <span className="flex shrink-0 items-center gap-2 text-[12px]">
                                    {deletions > 0 || additions === 0 ? (
                                      <span className="text-[#d06b72]">-{deletions}</span>
                                    ) : null}
                                    {additions > 0 || deletions === 0 ? (
                                      <span className="text-[color:var(--green)]">
                                        +{additions}
                                      </span>
                                    ) : null}
                                  </span>
                                </button>
                              );
                            }}
                            renderAnnotation={renderCommentAnnotation}
                            renderGutterUtility={(() => {
                              return (
                                getHoveredLine: () => GetHoveredLineResult<"diff"> | undefined,
                              ) => {
                                const hoveredLine = getHoveredLine();
                                if (!hoveredLine) {
                                  return null;
                                }

                                return (
                                  <button
                                    type="button"
                                    className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-[rgba(168,177,255,0.92)] text-[#1a1c26] shadow-[0_4px_12px_rgba(0,0,0,0.18)] transition hover:scale-[1.03]"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      openDraftComment(
                                        fileKey,
                                        filePath,
                                        hoveredLine.side,
                                        hoveredLine.lineNumber,
                                      );
                                    }}
                                    aria-label={`Add comment on ${filePath}:${hoveredLine.lineNumber}`}
                                    title={`Add comment on ${filePath}:${hoveredLine.lineNumber}`}
                                  >
                                    <MessageSquarePlus size={12} />
                                  </button>
                                );
                              };
                            })()}
                            options={{
                              diffStyle: diffRenderMode === "split" ? "split" : "unified",
                              lineDiffType: "none",
                              theme: resolveDiffThemeName("dark"),
                              themeType: "dark" as DiffThemeType,
                              unsafeCSS: DIFF_PANEL_UNSAFE_CSS,
                              collapsed: isCollapsed,
                              enableGutterUtility: true,
                              lineHoverHighlight: "both",
                              onLineClick: fileInteractionHandlers.onLineClick,
                              onLineNumberClick: fileInteractionHandlers.onLineNumberClick,
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
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
