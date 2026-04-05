import type { FileDiffMetadata } from "@pierre/diffs/react";
import {
  DIFF_FILE_ESTIMATED_COMMENT_HEIGHT,
  DIFF_FILE_ESTIMATED_FILE_GAP,
  DIFF_FILE_ESTIMATED_HEADER_HEIGHT,
  DIFF_FILE_ESTIMATED_LINE_HEIGHT,
  DIFF_FILE_ESTIMATED_SEPARATOR_HEIGHT,
} from "./diff-panel-content.constants";

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
