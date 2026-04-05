import type { FileDiffMetadata } from "@pierre/diffs/react";
import type { Virtualizer } from "@tanstack/react-virtual";
import { useEffect } from "react";
import { alignElementInScrollViewport, buildFileDiffRenderKey } from "./diff-panel-content.helpers";
import type { SavedDiffComment } from "./diffCommentStore";

export function useDiffPanelScrollAlignment({
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
}: {
  collapsedFiles: Record<string, boolean>;
  draftCardRef: React.RefObject<HTMLDivElement | null>;
  draftTarget: {
    fileKey: string;
    filePath: string;
    side: "deletions" | "additions";
    lineNumber: number;
    endSide?: "deletions" | "additions";
    endLineNumber?: number;
  } | null;
  fileListVirtualizer: Virtualizer<HTMLDivElement, Element>;
  renderableFiles: FileDiffMetadata[];
  savedComments: SavedDiffComment[];
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  selectedCommentId: string | null;
  selectedCommentJumpKey: number;
  selectedFilePath: string | null;
  setCollapsedFiles: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
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

      alignElementInScrollViewport({
        scrollContainer,
        targetElement: draftCard,
        mode: "draft-fit",
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [draftCardRef, draftTarget, scrollContainerRef]);

  useEffect(() => {
    if (!selectedCommentId || selectedCommentJumpKey < 0) {
      return;
    }

    const scrollContainer = scrollContainerRef.current;
    const selectedComment = savedComments.find((comment) => comment.id === selectedCommentId);
    if (!scrollContainer || !selectedComment) {
      return;
    }

    if (collapsedFiles[selectedComment.fileKey] === true) {
      setCollapsedFiles((current) => ({
        ...current,
        [selectedComment.fileKey]: false,
      }));
      return;
    }

    const selectedFileIndex = renderableFiles.findIndex(
      (fileDiff) => buildFileDiffRenderKey(fileDiff) === selectedComment.fileKey,
    );
    if (selectedFileIndex >= 0) {
      fileListVirtualizer.scrollToIndex(selectedFileIndex, { align: "center" });
    }

    let cancelled = false;
    let attempts = 0;
    let frame = 0;

    const alignSelectedComment = () => {
      if (cancelled) {
        return;
      }

      const commentElement = Array.from(
        scrollContainer.querySelectorAll<HTMLElement>("[data-saved-diff-comment-id]"),
      ).find((element) => element.dataset.savedDiffCommentId === selectedCommentId);

      if (commentElement) {
        alignElementInScrollViewport({
          scrollContainer,
          targetElement: commentElement,
          mode: "center",
        });
        return;
      }

      if (attempts >= 6) {
        const fileElement = Array.from(
          scrollContainer.querySelectorAll<HTMLElement>("[data-diff-file-path]"),
        ).find((element) => element.dataset.diffFilePath === selectedFilePath);

        if (fileElement) {
          alignElementInScrollViewport({
            scrollContainer,
            targetElement: fileElement,
            mode: "center",
          });
        }
        return;
      }

      attempts += 1;
      frame = window.requestAnimationFrame(alignSelectedComment);
    };

    frame = window.requestAnimationFrame(alignSelectedComment);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [
    collapsedFiles,
    fileListVirtualizer,
    renderableFiles,
    savedComments,
    scrollContainerRef,
    selectedCommentId,
    selectedCommentJumpKey,
    selectedFilePath,
    setCollapsedFiles,
  ]);
}
