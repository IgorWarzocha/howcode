import { parsePatchFiles } from "@pierre/diffs";
import type { FileDiffMetadata } from "@pierre/diffs/react";
import type { AnnotationSide } from "@pierre/diffs/react";
import { buildPatchCacheKey } from "./diff-rendering";
import type { DiffCommentDraft } from "./diffCommentStore";

export type RenderablePatch =
  | {
      kind: "files";
      files: FileDiffMetadata[];
    }
  | {
      kind: "raw";
      text: string;
      reason: string;
    };

export type DiffCommentMetadata = {
  id: string;
  body: string;
  kind: "comment" | "draft";
  side: AnnotationSide;
  lineNumber: number;
  endSide?: AnnotationSide;
  endLineNumber?: number;
};

export const DIFF_FILE_ESTIMATED_LINE_HEIGHT = 20;
export const DIFF_FILE_ESTIMATED_HEADER_HEIGHT = 36;
export const DIFF_FILE_ESTIMATED_FILE_GAP = 8;
export const DIFF_FILE_ESTIMATED_SEPARATOR_HEIGHT = 32;
export const DIFF_FILE_ESTIMATED_COMMENT_HEIGHT = 92;

export const DIFF_PANEL_UNSAFE_CSS = `
:host {
  color-scheme: dark;
  --diffs-header-font-family: var(--font-sans, "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif) !important;
  --diffs-font-family: "JetBrains Mono", "SFMono-Regular", Consolas, monospace !important;
  --diffs-light-bg: var(--workspace) !important;
  --diffs-dark-bg: var(--workspace) !important;
  --diffs-bg: var(--workspace) !important;
  --diffs-light: var(--text) !important;
  --diffs-dark: var(--text) !important;
  --diffs-token-light: currentColor !important;
  --diffs-token-dark: currentColor !important;
  --diffs-token-light-bg: transparent !important;
  --diffs-token-dark-bg: transparent !important;
  --diffs-token-light-font-weight: inherit !important;
  --diffs-token-dark-font-weight: inherit !important;
  --diffs-token-light-font-style: inherit !important;
  --diffs-token-dark-font-style: inherit !important;
  --diffs-token-light-text-decoration: none !important;
  --diffs-token-dark-text-decoration: none !important;
  --diffs-fg-number-override: var(--muted) !important;
  --diffs-fg-number-addition-override: var(--green) !important;
  --diffs-fg-number-deletion-override: #d06b72 !important;
  --diffs-fg-conflict-marker-override: var(--muted) !important;
  --diffs-addition-color-override: var(--green) !important;
  --diffs-deletion-color-override: #d06b72 !important;
  --diffs-modified-color-override: var(--accent) !important;
  --diffs-bg-context-override: var(--workspace) !important;
  --diffs-bg-context-number-override: var(--workspace) !important;
  --diffs-bg-hover-override: var(--panel) !important;
  --diffs-bg-separator-override: var(--panel) !important;
  --diffs-bg-buffer-override: var(--panel-2) !important;
  --diffs-bg-addition-override: color-mix(in srgb, var(--workspace) 90%, var(--green)) !important;
  --diffs-bg-addition-number-override: color-mix(in srgb, var(--workspace) 86%, var(--green)) !important;
  --diffs-bg-addition-hover-override: color-mix(in srgb, var(--workspace) 84%, var(--green)) !important;
  --diffs-bg-addition-emphasis-override: color-mix(in srgb, var(--workspace) 78%, var(--green)) !important;
  --diffs-bg-deletion-override: color-mix(in srgb, var(--workspace) 90%, #d06b72) !important;
  --diffs-bg-deletion-number-override: color-mix(in srgb, var(--workspace) 86%, #d06b72) !important;
  --diffs-bg-deletion-hover-override: color-mix(in srgb, var(--workspace) 84%, #d06b72) !important;
  --diffs-bg-deletion-emphasis-override: color-mix(in srgb, var(--workspace) 78%, #d06b72) !important;
  --diffs-selection-color-override: var(--accent) !important;
  --diffs-bg-selection-override: var(--panel-3) !important;
  --diffs-bg-selection-number-override: var(--panel-2) !important;
  --diffs-bg-conflict-marker-override: var(--panel-2) !important;
  --diffs-bg-conflict-marker-number-override: var(--panel-3) !important;
  --diffs-bg-conflict-current-override: var(--panel) !important;
  --diffs-bg-conflict-current-number-override: var(--panel-2) !important;
  --diffs-bg-conflict-base-override: var(--panel) !important;
  --diffs-bg-conflict-base-number-override: var(--panel-2) !important;
  --diffs-bg-conflict-incoming-override: var(--panel) !important;
  --diffs-bg-conflict-incoming-number-override: var(--panel-2) !important;
  --conflict-bg-current-override: var(--panel) !important;
  --conflict-bg-current-number-override: var(--panel-2) !important;
  --conflict-bg-incoming-override: var(--panel) !important;
  --conflict-bg-incoming-number-override: var(--panel-2) !important;
  --conflict-bg-current-header-override: var(--panel-2) !important;
  --conflict-bg-current-header-number-override: var(--panel-3) !important;
  --conflict-bg-incoming-header-override: var(--panel-2) !important;
  --conflict-bg-incoming-header-number-override: var(--panel-3) !important;
  --diffs-gap-style: 1px solid var(--border) !important;
  background-color: var(--workspace) !important;
  color: var(--text) !important;
}

[data-diff-span],
[data-line] span {
  background-color: transparent !important;
  color: inherit !important;
  font-weight: inherit !important;
  font-style: inherit !important;
  text-decoration: none !important;
}

[data-diff],
[data-file] {
  background-color: var(--workspace) !important;
  border-top: 1px solid var(--border) !important;
}

[data-gutter] [data-column-number],
[data-gutter] [data-gutter-buffer] {
  border-right: 1px solid var(--border) !important;
}

[data-content-buffer],
[data-gutter-buffer='buffer'] {
  background-color: var(--workspace) !important;
}

[data-file-info] {
  background-color: var(--panel) !important;
  border-block-color: var(--border) !important;
  color: var(--text) !important;
}

[data-diffs-header='default'] {
  background-color: var(--panel) !important;
  border-bottom: 1px solid var(--border) !important;
  color: var(--text) !important;
}

[data-diffs-header='custom'] {
  background-color: var(--panel) !important;
  border-bottom: 1px solid var(--border) !important;
  color: var(--text) !important;
}

slot[name='header-custom'] {
  display: block;
  width: 100%;
  min-width: 0;
}

[data-header-content] {
  align-items: center !important;
}

slot[name='header-prefix'] {
  order: 99;
  margin-left: 8px;
}

slot[name='header-prefix']::slotted(*) {
  color: var(--muted) !important;
  font-family: var(--diffs-header-font-family) !important;
}

[data-change-icon],
[data-rename-icon] {
  width: 14px;
  height: 14px;
  align-self: center;
  flex: 0 0 auto;
}

[data-prev-name],
[data-diffs-header='default'] [data-metadata],
[data-separator-wrapper],
[data-separator-content],
[data-expand-button],
[data-merge-conflict-action],
[data-merge-conflict-action-separator] {
  color: var(--muted) !important;
}

[data-separator='line-info'],
[data-separator='line-info-basic'],
[data-separator='metadata'],
[data-separator='simple'],
[data-separator-wrapper],
[data-separator-content],
[data-expand-button] {
  background-color: var(--panel) !important;
}

[data-separator='line-info'][data-separator-first],
[data-separator='line-info-basic'][data-separator-first] {
  display: none !important;
}

[data-expand-button]:hover,
[data-merge-conflict-action]:hover {
  background-color: var(--panel-2) !important;
  color: var(--text) !important;
}

[data-diff-type='split'][data-overflow='scroll'] [data-additions] {
  border-left: 1px solid var(--border) !important;
}

[data-diff-type='split'][data-overflow='scroll'] [data-deletions] {
  border-right: 1px solid var(--border) !important;
}

[data-diff-type='split'][data-overflow='wrap'] [data-deletions] [data-content] {
  border-right: 1px solid var(--border) !important;
}

[data-diff-type='split'][data-overflow='wrap'] [data-additions] [data-gutter] {
  border-left: 1px solid var(--border) !important;
}

[data-title] {
  cursor: pointer;
}

[data-line-annotation] {
  --diffs-line-bg: var(--workspace);
}

[data-line-annotation],
[data-gutter-buffer='annotation'],
[data-merge-conflict-actions],
[data-gutter-buffer='merge-conflict-action'] {
  background-color: var(--workspace) !important;
}

[data-selected-line][data-line] {
  background-color: var(--panel-3) !important;
}

[data-selected-line][data-column-number],
[data-selected-line][data-gutter-buffer='annotation'] {
  background-color: var(--panel-2) !important;
  color: var(--text) !important;
}

[data-line-type='change-addition'][data-selected-line][data-line],
[data-line-type='change-addition'][data-selected-line][data-line][data-hovered] {
  background-color: color-mix(in srgb, var(--panel-3) 84%, var(--green)) !important;
}

[data-line-type='change-deletion'][data-selected-line][data-line],
[data-line-type='change-deletion'][data-selected-line][data-line][data-hovered] {
  background-color: color-mix(in srgb, var(--panel-3) 84%, #d06b72) !important;
}

[data-line-type='change-addition'][data-selected-line][data-column-number],
[data-line-type='change-addition'][data-selected-line][data-column-number][data-hovered] {
  background-color: color-mix(in srgb, var(--panel-2) 84%, var(--green)) !important;
}

[data-line-type='change-deletion'][data-selected-line][data-column-number],
[data-line-type='change-deletion'][data-selected-line][data-column-number][data-hovered] {
  background-color: color-mix(in srgb, var(--panel-2) 84%, #d06b72) !important;
}

[data-change-icon='change'],
[data-change-icon='rename-pure'],
[data-change-icon='rename-changed'] {
  color: var(--accent) !important;
}

[data-change-icon='new'] {
  color: var(--green) !important;
}

[data-change-icon='deleted'] {
  color: var(--muted-2) !important;
}

[data-utility-button] {
  background-color: var(--panel-3) !important;
  color: var(--text) !important;
}

[data-annotation-content] {
  padding-block: 4px 0;
}
`;

export function getRenderablePatch(
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

export function resolveFileDiffPath(fileDiff: FileDiffMetadata): string {
  const raw = fileDiff.name ?? fileDiff.prevName ?? "";
  if (raw.startsWith("a/") || raw.startsWith("b/")) {
    return raw.slice(2);
  }
  return raw;
}

export function buildFileDiffRenderKey(fileDiff: FileDiffMetadata): string {
  return fileDiff.cacheKey ?? `${fileDiff.prevName ?? "none"}:${fileDiff.name}`;
}

export function formatTurnChipTimestamp(isoDate: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoDate));
}

export function joinProjectFilePath(projectId: string, filePath: string) {
  const normalizedProjectId = projectId.replace(/\/$/, "");
  const normalizedFilePath = filePath.replace(/^\.\//, "");
  return `${normalizedProjectId}/${normalizedFilePath}`;
}

export function isSameDraftTarget(
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

export function buildDraftTarget({
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

export function describeCommentTarget({
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

export function describeCollapsedLines(count: number) {
  return `${count} unmodified line${count === 1 ? "" : "s"}`;
}

export function getFileHeaderContextLabel(fileDiff: FileDiffMetadata) {
  const collapsedBefore = fileDiff.hunks[0]?.collapsedBefore ?? 0;
  return collapsedBefore > 0 ? describeCollapsedLines(collapsedBefore) : null;
}

export function getFileChangeCounts(fileDiff: FileDiffMetadata) {
  let additions = 0;
  let deletions = 0;

  for (const hunk of fileDiff.hunks) {
    additions += hunk.additionLines;
    deletions += hunk.deletionLines;
  }

  return { additions, deletions };
}

export function alignElementInScrollViewport({
  scrollContainer,
  targetElement,
  mode,
}: {
  scrollContainer: HTMLDivElement;
  targetElement: HTMLElement;
  mode: "center" | "draft-fit";
}) {
  const containerRect = scrollContainer.getBoundingClientRect();
  const targetRect = targetElement.getBoundingClientRect();

  if (mode === "draft-fit") {
    const viewportPadding = 8;
    const availableHeight = containerRect.height - viewportPadding * 2;

    if (targetRect.height <= availableHeight) {
      const bottomOverflow = targetRect.bottom - (containerRect.bottom - viewportPadding);
      const topOverflow = containerRect.top + viewportPadding - targetRect.top;

      if (bottomOverflow > 0) {
        scrollContainer.scrollTop += bottomOverflow;
        return;
      }

      if (topOverflow > 0) {
        scrollContainer.scrollTop -= topOverflow;
      }
      return;
    }

    const desiredVisibleDraftHeight = Math.min(120, targetRect.height);
    const desiredDraftTop = containerRect.bottom - desiredVisibleDraftHeight;
    const bottomOverflow = targetRect.top - desiredDraftTop;
    const topOverflow = containerRect.top + viewportPadding - targetRect.top;

    if (bottomOverflow > 0) {
      scrollContainer.scrollTop += bottomOverflow + 6;
      return;
    }

    if (topOverflow > 0) {
      scrollContainer.scrollTop -= topOverflow;
    }
    return;
  }

  const desiredTargetTop = containerRect.top + (containerRect.height - targetRect.height) / 2;
  const offset = targetRect.top - desiredTargetTop;

  if (Math.abs(offset) > 4) {
    scrollContainer.scrollTop += offset;
  }
}

export function estimateFileDiffHeight({
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

export function resolvePointerLineTarget(event: MouseEvent | PointerEvent): {
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

export function orderTurnDiffSummaries<
  T extends { checkpointTurnCount: number; completedAt: string },
>(summaries: readonly T[]) {
  return [...summaries].sort((left, right) => {
    if (left.checkpointTurnCount !== right.checkpointTurnCount) {
      return right.checkpointTurnCount - left.checkpointTurnCount;
    }

    return right.completedAt.localeCompare(left.completedAt);
  });
}

export function orderRenderableFiles(fileDiffs: readonly FileDiffMetadata[]) {
  return [...fileDiffs].sort((left, right) =>
    resolveFileDiffPath(left).localeCompare(resolveFileDiffPath(right), undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );
}
