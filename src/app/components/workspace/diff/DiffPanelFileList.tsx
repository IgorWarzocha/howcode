import type { GetHoveredLineResult, SelectedLineRange } from "@pierre/diffs";
import {
  type AnnotationSide,
  type DiffLineAnnotation,
  FileDiff,
  type FileDiffMetadata,
} from "@pierre/diffs/react";
import type { VirtualItem } from "@tanstack/react-virtual";
import { ChevronDown, ChevronRight, MessageSquarePlus } from "lucide-react";
import { cn } from "../../../utils/cn";
import {
  DIFF_PANEL_UNSAFE_CSS,
  type DiffCommentMetadata,
  getFileChangeCounts,
  getFileHeaderContextLabel,
  joinProjectFilePath,
} from "./diff-panel-content.helpers";
import { resolveDiffThemeName } from "./diff-rendering";

type FileInteractionHandlers = {
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
};

type DiffPanelFileListProps = {
  collapsedFiles: Record<string, boolean>;
  commentAnnotationsByFile: Map<string, DiffLineAnnotation<DiffCommentMetadata>[]>;
  diffRenderMode: "stacked" | "split";
  getFileInteractionHandlers: (fileKey: string, filePath: string) => FileInteractionHandlers;
  getSelectedLinesForFile: (
    fileKey: string,
    draftSelectedLines: SelectedLineRange | null,
  ) => SelectedLineRange | null;
  handleFilePointerDownCapture: (
    event: React.PointerEvent<HTMLDivElement>,
    fileKey: string,
    filePath: string,
  ) => void;
  measureElement: (element: Element | null) => void;
  onOpenDraftComment: (
    fileKey: string,
    filePath: string,
    side: AnnotationSide,
    lineNumber: number,
  ) => void;
  onToggleFileCollapsed: (fileKey: string) => void;
  projectId: string;
  renderCommentAnnotation: (annotation: DiffLineAnnotation<DiffCommentMetadata>) => React.ReactNode;
  renderableFiles: FileDiffMetadata[];
  totalSize: number;
  virtualItems: VirtualItem[];
  draftSelectedLines: SelectedLineRange | null;
};

export function DiffPanelFileList({
  collapsedFiles,
  commentAnnotationsByFile,
  diffRenderMode,
  getFileInteractionHandlers,
  getSelectedLinesForFile,
  handleFilePointerDownCapture,
  measureElement,
  onOpenDraftComment,
  onToggleFileCollapsed,
  projectId,
  renderCommentAnnotation,
  renderableFiles,
  totalSize,
  virtualItems,
  draftSelectedLines,
}: DiffPanelFileListProps) {
  return (
    <div className="relative w-full" style={{ height: totalSize }}>
      <div style={{ transform: `translateY(${virtualItems[0]?.start ?? 0}px)` }}>
        {virtualItems.map((virtualRow) => {
          const fileDiff = renderableFiles[virtualRow.index] as FileDiffMetadata;
          const filePath = fileDiff.name?.replace(/^[ab]\//, "") ?? fileDiff.prevName ?? "";
          const fileKey = fileDiff.cacheKey ?? `${fileDiff.prevName ?? "none"}:${fileDiff.name}`;
          const isCollapsed = collapsedFiles[fileKey] === true;
          const fileInteractionHandlers = getFileInteractionHandlers(fileKey, filePath);
          const selectedLines = getSelectedLinesForFile(fileKey, draftSelectedLines);

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              data-diff-file-path={filePath}
              className="first:mt-0"
              ref={measureElement}
              onPointerDownCapture={(event) =>
                handleFilePointerDownCapture(event, fileKey, filePath)
              }
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
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onToggleFileCollapsed(fileKey);
                      }}
                      aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${filePath}`}
                      aria-expanded={!isCollapsed}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-[color:var(--muted)]">
                          {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
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
                          <span className="text-[color:var(--green)]">+{additions}</span>
                        ) : null}
                      </span>
                    </button>
                  );
                }}
                renderAnnotation={renderCommentAnnotation}
                renderGutterUtility={(() => {
                  return (getHoveredLine: () => GetHoveredLineResult<"diff"> | undefined) => {
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
                          onOpenDraftComment(
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
                  themeType: "dark",
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
  );
}
