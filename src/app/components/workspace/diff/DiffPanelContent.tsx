import {
  type AnnotationSide,
  type DiffLineAnnotation,
  FileDiff,
  type FileDiffMetadata,
  type GetHoveredLineResult,
  type SelectedLineRange,
  Virtualizer,
} from "@pierre/diffs/react";
import { MessageSquarePlus, X } from "lucide-react";
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
import { buildDiffCommentPrompt } from "./diffCommentPrompt";
import {
  type DiffCommentDraft,
  type SavedDiffComment,
  diffCommentStore,
  getDiffCommentContextId,
} from "./diffCommentStore";

type DiffRenderMode = "stacked" | "split";
type DiffThemeType = "light" | "dark";

type DiffCommentMetadata = {
  id: string;
  body: string;
  kind: "comment" | "draft";
  createdAt?: string;
};

type DiffPanelContentProps = {
  projectId: string;
  threadData: ThreadData | null;
  isGitRepo: boolean;
  selectedTurnCount: number | null;
  selectedFilePath: string | null;
  onSelectTurn: (checkpointTurnCount: number | null) => void;
  layoutMode?: "split" | "overlay" | "main";
  onSendCommentsToAgent: (prompt: string) => Promise<void>;
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
  onSendCommentsToAgent,
  onClose,
  onAction,
}: DiffPanelContentProps) {
  const [diffRenderMode, setDiffRenderMode] = useState<DiffRenderMode>("stacked");
  const [savedComments, setSavedComments] = useState<SavedDiffComment[]>([]);
  const [draftComment, setDraftComment] = useState<DiffCommentDraft | null>(null);
  const [commentsSending, setCommentsSending] = useState(false);
  const [commentActionError, setCommentActionError] = useState<string | null>(null);
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
  const diffCommentContextId = useMemo(
    () =>
      getDiffCommentContextId({
        sessionPath: threadData?.sessionPath ?? null,
        selectedTurnCount,
      }),
    [selectedTurnCount, threadData?.sessionPath],
  );

  useEffect(() => {
    if (!diffCommentContextId) {
      setSavedComments([]);
      setDraftComment(null);
      setCommentActionError(null);
      return;
    }

    const persistedContext = diffCommentStore.getContext(diffCommentContextId);
    setSavedComments(persistedContext?.comments ?? []);
    setDraftComment(persistedContext?.draft ?? null);
    setCommentActionError(null);
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
          createdAt: comment.createdAt,
        },
      });
      next.set(comment.fileKey, entries);
    }

    if (draftComment) {
      const entries = next.get(draftComment.fileKey) ?? [];
      entries.push({
        side: draftComment.side,
        lineNumber: draftComment.lineNumber,
        metadata: {
          id: `draft:${draftComment.fileKey}:${draftComment.side}:${draftComment.lineNumber}`,
          body: draftComment.body,
          kind: "draft",
        },
      });
      next.set(draftComment.fileKey, entries);
    }

    return next;
  }, [draftComment, savedComments]);

  const openDraftComment = (
    fileKey: string,
    filePath: string,
    side: AnnotationSide,
    lineNumber: number,
  ) => {
    setDraftComment((current) => {
      if (
        current &&
        current.fileKey === fileKey &&
        current.side === side &&
        current.lineNumber === lineNumber
      ) {
        return current;
      }

      return {
        fileKey,
        filePath,
        side,
        lineNumber,
        body: "",
      };
    });
    setCommentActionError(null);
  };

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
    setCommentActionError(null);
  };

  const removeComment = (commentId: string) => {
    setSavedComments((current) => current.filter((comment) => comment.id !== commentId));
  };

  const handleSendCommentsToAgent = async () => {
    if (savedComments.length === 0 || commentsSending) {
      return;
    }

    setCommentsSending(true);
    setCommentActionError(null);

    try {
      await onSendCommentsToAgent(
        buildDiffCommentPrompt({
          comments: savedComments,
          selectedTurnCount,
        }),
      );
      setSavedComments([]);
      setDraftComment(null);
      if (diffCommentContextId) {
        diffCommentStore.clearContext(diffCommentContextId);
      }
    } catch (error) {
      setCommentActionError(
        error instanceof Error ? error.message : "Could not send comments to the agent.",
      );
    } finally {
      setCommentsSending(false);
    }
  };

  const renderCommentAnnotation = (annotation: DiffLineAnnotation<DiffCommentMetadata>) => {
    const metadata = annotation.metadata;

    if (metadata.kind === "draft") {
      return (
        <div className="mx-3 mb-2 rounded-xl border border-[color:var(--border)] bg-[rgba(31,34,46,0.96)] p-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
          <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[color:var(--muted)]">
            Add comment · {annotation.side === "deletions" ? "Old" : "New"} line{" "}
            {annotation.lineNumber}
          </div>
          <textarea
            className="min-h-20 w-full resize-y rounded-lg border border-[rgba(169,178,215,0.08)] bg-[rgba(19,21,30,0.92)] px-3 py-2 text-[12px] leading-5 text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted)]"
            value={draftComment?.body ?? ""}
            onChange={(event) =>
              setDraftComment((current) =>
                current
                  ? {
                      ...current,
                      body: event.target.value,
                    }
                  : current,
              )
            }
            placeholder="Leave a note on this diff"
            aria-label={`Comment for line ${annotation.lineNumber}`}
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-[11px] text-[color:var(--muted)] hover:text-[color:var(--text)]"
              onClick={() => setDraftComment(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-lg bg-[color:var(--accent)] px-2.5 py-1 text-[11px] font-medium text-[#1a1c26] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={persistDraftComment}
              disabled={(draftComment?.body.trim().length ?? 0) === 0}
            >
              Save comment
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="mx-3 mb-2 rounded-xl border border-[color:var(--border)] bg-[rgba(31,34,46,0.9)] px-3 py-2.5 shadow-[0_10px_24px_rgba(0,0,0,0.16)]">
        <div className="mb-1 flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.12em] text-[color:var(--muted)]">
          <span>
            Comment · {annotation.side === "deletions" ? "Old" : "New"} line {annotation.lineNumber}
          </span>
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
        {metadata.createdAt ? (
          <div className="mt-2 text-[10px] text-[color:var(--muted)]">
            {new Intl.DateTimeFormat(undefined, {
              hour: "numeric",
              minute: "2-digit",
              month: "short",
              day: "numeric",
            }).format(new Date(metadata.createdAt))}
          </div>
        ) : null}
      </div>
    );
  };

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
            commentCount={savedComments.length}
            commentsSending={commentsSending}
            onClose={onClose}
            onAction={onAction}
            onSendCommentsToAgent={handleSendCommentsToAgent}
            onSelectTurn={onSelectTurn}
            onSetDiffRenderMode={setDiffRenderMode}
          />

          <div ref={patchViewportRef} className="min-h-0 min-w-0 flex-1 overflow-hidden">
            {commentActionError ? (
              <div className="px-3 pt-3">
                <p className="mb-0 text-[11px] text-[#f2a7a7]">{commentActionError}</p>
              </div>
            ) : null}
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
                  const selectedLines: SelectedLineRange | null =
                    draftComment?.fileKey === fileKey
                      ? {
                          start: draftComment.lineNumber,
                          end: draftComment.lineNumber,
                          side: draftComment.side,
                          endSide: draftComment.side,
                        }
                      : null;
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
                      <FileDiff<DiffCommentMetadata>
                        fileDiff={fileDiff}
                        lineAnnotations={commentAnnotationsByFile.get(fileKey)}
                        selectedLines={selectedLines}
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
                          enableGutterUtility: true,
                          lineHoverHighlight: "both",
                          onLineNumberClick: ({ lineNumber, side, event }) => {
                            event.preventDefault();
                            openDraftComment(fileKey, filePath, side, lineNumber);
                          },
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
