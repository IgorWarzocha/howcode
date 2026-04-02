import { parsePatchFiles } from "@pierre/diffs";
import { FileDiff, type FileDiffMetadata, Virtualizer } from "@pierre/diffs/react";
import { Columns2, GitCompareArrows, Rows3 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DesktopAction } from "../../../desktop/actions";
import type { ThreadData } from "../../../desktop/types";
import {
  getFeatureStatusAccentClass,
  getFeatureStatusButtonClass,
} from "../../../features/feature-status";
import { useDesktopDiff } from "../../../hooks/useDesktopDiff";
import { cn } from "../../../utils/cn";
import { buildPatchCacheKey, resolveDiffThemeName } from "./diff-rendering";

type DiffRenderMode = "stacked" | "split";
type DiffThemeType = "light" | "dark";

const DIFF_PANEL_UNSAFE_CSS = `
[data-diffs-header],
[data-diff],
[data-file],
[data-error-wrapper],
[data-virtualizer-buffer] {
  --diffs-bg: color-mix(in srgb, var(--panel) 88%, var(--workspace)) !important;
  --diffs-light-bg: color-mix(in srgb, var(--panel) 88%, var(--workspace)) !important;
  --diffs-dark-bg: color-mix(in srgb, var(--panel) 88%, var(--workspace)) !important;
  --diffs-token-light-bg: transparent;
  --diffs-token-dark-bg: transparent;
  --diffs-bg-context-override: color-mix(in srgb, var(--workspace) 96%, var(--text));
  --diffs-bg-hover-override: color-mix(in srgb, var(--workspace) 92%, var(--text));
  --diffs-bg-separator-override: color-mix(in srgb, var(--workspace) 94%, var(--text));
  --diffs-bg-buffer-override: color-mix(in srgb, var(--workspace) 90%, var(--text));
  --diffs-bg-addition-override: color-mix(in srgb, var(--workspace) 90%, var(--green));
  --diffs-bg-addition-number-override: color-mix(in srgb, var(--workspace) 84%, var(--green));
  --diffs-bg-addition-hover-override: color-mix(in srgb, var(--workspace) 82%, var(--green));
  --diffs-bg-addition-emphasis-override: color-mix(in srgb, var(--workspace) 76%, var(--green));
  --diffs-bg-deletion-override: color-mix(in srgb, var(--workspace) 90%, #d06b72);
  --diffs-bg-deletion-number-override: color-mix(in srgb, var(--workspace) 84%, #d06b72);
  --diffs-bg-deletion-hover-override: color-mix(in srgb, var(--workspace) 82%, #d06b72);
  --diffs-bg-deletion-emphasis-override: color-mix(in srgb, var(--workspace) 76%, #d06b72);
  background-color: var(--diffs-bg) !important;
}

[data-file-info] {
  background-color: color-mix(in srgb, var(--panel) 94%, var(--text)) !important;
  border-block-color: var(--border) !important;
  color: var(--text) !important;
}

[data-diffs-header] {
  position: sticky !important;
  top: 0;
  z-index: 4;
  background-color: color-mix(in srgb, var(--panel) 94%, var(--text)) !important;
  border-bottom: 1px solid var(--border) !important;
}

[data-title] {
  cursor: pointer;
}
`;

type RenderablePatch =
  | {
      kind: "files";
      files: FileDiffMetadata[];
    }
  | {
      kind: "raw";
      text: string;
      reason: string;
    };

function getRenderablePatch(
  patch: string | undefined,
  cacheScope = "diff-panel",
): RenderablePatch | null {
  if (!patch) return null;
  const normalizedPatch = patch.trim();
  if (normalizedPatch.length === 0) return null;

  try {
    const parsedPatches = parsePatchFiles(
      normalizedPatch,
      buildPatchCacheKey(normalizedPatch, cacheScope),
    );
    const files = parsedPatches.flatMap((parsedPatch) => parsedPatch.files);
    if (files.length > 0) {
      return { kind: "files", files };
    }

    return {
      kind: "raw",
      text: normalizedPatch,
      reason: "Unsupported diff format. Showing raw patch.",
    };
  } catch {
    return {
      kind: "raw",
      text: normalizedPatch,
      reason: "Failed to parse patch. Showing raw patch.",
    };
  }
}

function resolveFileDiffPath(fileDiff: FileDiffMetadata): string {
  const raw = fileDiff.name ?? fileDiff.prevName ?? "";
  if (raw.startsWith("a/") || raw.startsWith("b/")) {
    return raw.slice(2);
  }
  return raw;
}

function buildFileDiffRenderKey(fileDiff: FileDiffMetadata): string {
  return fileDiff.cacheKey ?? `${fileDiff.prevName ?? "none"}:${fileDiff.name}`;
}

function formatTurnChipTimestamp(isoDate: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoDate));
}

function joinProjectFilePath(projectId: string, filePath: string) {
  const normalizedProjectId = projectId.replace(/\/$/, "");
  const normalizedFilePath = filePath.replace(/^\.\//, "");
  return `${normalizedProjectId}/${normalizedFilePath}`;
}

type DiffPanelContentProps = {
  projectId: string;
  threadData: ThreadData | null;
  isGitRepo: boolean;
  selectedTurnCount: number | null;
  selectedFilePath: string | null;
  onSelectTurn: (checkpointTurnCount: number | null) => void;
  onAction: (action: DesktopAction, payload?: Record<string, unknown>) => void;
};

export function DiffPanelContent({
  projectId,
  threadData,
  isGitRepo,
  selectedTurnCount,
  selectedFilePath,
  onSelectTurn,
  onAction,
}: DiffPanelContentProps) {
  const [diffRenderMode, setDiffRenderMode] = useState<DiffRenderMode>("stacked");
  const patchViewportRef = useRef<HTMLDivElement>(null);
  const orderedTurnDiffSummaries = useMemo(
    () =>
      [...(threadData?.turnDiffSummaries ?? [])].sort((left, right) => {
        if (left.checkpointTurnCount !== right.checkpointTurnCount) {
          return right.checkpointTurnCount - left.checkpointTurnCount;
        }

        return right.completedAt.localeCompare(left.completedAt);
      }),
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
  const renderableFiles = useMemo(() => {
    if (!renderablePatch || renderablePatch.kind !== "files") {
      return [];
    }

    return [...renderablePatch.files].sort((left, right) =>
      resolveFileDiffPath(left).localeCompare(resolveFileDiffPath(right), undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );
  }, [renderablePatch]);

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
        "grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden border-l border-[color:var(--border)] bg-[color:var(--workspace)] xl:w-full",
      )}
      data-feature-id="feature:diff.panel"
      data-feature-status="partial"
    >
      <div className="flex h-11 items-center justify-between border-b border-[color:var(--border)] px-3.5">
        <div className="inline-flex min-w-0 items-center gap-2 text-[12.5px] font-medium text-[color:var(--text)]">
          <GitCompareArrows size={14} />
          <span>Diff</span>
          <span
            aria-hidden="true"
            className={cn(
              "h-1.5 w-1.5 rounded-full border",
              getFeatureStatusAccentClass("feature:diff.panel"),
            )}
          />
        </div>
        <button
          type="button"
          className={cn(
            "inline-flex h-7 items-center rounded-[8px] border border-transparent px-2 text-[12px] text-[color:var(--muted)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]",
            getFeatureStatusButtonClass("feature:diff.review"),
          )}
          onClick={() => onAction("diff.review")}
        >
          Review
        </button>
      </div>

      {!threadData ? (
        <div className="flex min-h-[240px] items-center justify-center px-5 text-center text-xs text-[color:var(--muted)]">
          Select a thread to inspect turn diffs.
        </div>
      ) : !isGitRepo ? (
        <div className="flex min-h-[240px] items-center justify-center px-5 text-center text-xs text-[color:var(--muted)]">
          Turn diffs are unavailable because this project is not a git repository.
        </div>
      ) : orderedTurnDiffSummaries.length === 0 ? (
        <div className="flex min-h-[240px] items-center justify-center px-5 text-center text-xs text-[color:var(--muted)]">
          No completed turns yet.
        </div>
      ) : (
        <>
          <div className="flex min-h-10 items-center justify-between gap-2 border-b border-[color:var(--border)] px-3 py-1.5">
            <div className="diff-turn-strip flex min-w-0 flex-1 gap-1 overflow-x-auto py-0.5">
              <button
                type="button"
                className={cn(
                  "shrink-0 rounded-[8px] border px-2 py-1 text-left transition-colors",
                  selectedTurnCount === null
                    ? "border-[color:var(--border-strong)] bg-[rgba(255,255,255,0.06)] text-[color:var(--text)]"
                    : "border-[color:var(--border)] bg-transparent text-[color:var(--muted)] hover:text-[color:var(--text)]",
                )}
                onClick={() => onSelectTurn(null)}
              >
                <div className="text-[10px] leading-tight font-medium">All turns</div>
              </button>
              {orderedTurnDiffSummaries.map((summary: ThreadData["turnDiffSummaries"][number]) => (
                <button
                  key={summary.checkpointTurnCount}
                  type="button"
                  className={cn(
                    "shrink-0 rounded-[8px] border px-2 py-1 text-left transition-colors",
                    summary.checkpointTurnCount === selectedTurnCount
                      ? "border-[color:var(--border-strong)] bg-[rgba(255,255,255,0.06)] text-[color:var(--text)]"
                      : "border-[color:var(--border)] bg-transparent text-[color:var(--muted)] hover:text-[color:var(--text)]",
                  )}
                  onClick={() => onSelectTurn(summary.checkpointTurnCount)}
                >
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] leading-tight font-medium">
                      Turn {summary.checkpointTurnCount}
                    </span>
                    <span className="text-[9px] leading-tight opacity-70">
                      {formatTurnChipTimestamp(summary.completedAt)}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-[8px] border text-[color:var(--muted)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]",
                  diffRenderMode === "stacked"
                    ? "border-[color:var(--border-strong)] bg-[rgba(255,255,255,0.06)]"
                    : "border-[color:var(--border)] bg-transparent",
                )}
                onClick={() => setDiffRenderMode("stacked")}
                aria-label="Unified diff view"
                title="Unified diff view"
              >
                <Rows3 size={14} />
              </button>
              <button
                type="button"
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-[8px] border text-[color:var(--muted)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]",
                  diffRenderMode === "split"
                    ? "border-[color:var(--border-strong)] bg-[rgba(255,255,255,0.06)]"
                    : "border-[color:var(--border)] bg-transparent",
                )}
                onClick={() => setDiffRenderMode("split")}
                aria-label="Split diff view"
                title="Split diff view"
              >
                <Columns2 size={14} />
              </button>
            </div>
          </div>

          <div ref={patchViewportRef} className="min-h-0 min-w-0 flex-1 overflow-hidden">
            {error && !renderablePatch ? (
              <div className="px-3 pt-3">
                <p className="mb-2 text-[11px] text-[#f2a7a7]">{error}</p>
              </div>
            ) : null}

            {!renderablePatch ? (
              <div className="flex h-full items-center justify-center px-3 py-2 text-xs text-[color:var(--muted)]">
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
                  <pre className="max-h-[72vh] overflow-auto rounded-md border border-[color:var(--border)] bg-[rgba(18,20,28,0.7)] p-3 font-mono text-[11px] leading-relaxed text-[color:var(--text)]/90">
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
