import type { SelectedLineRange } from "@pierre/diffs";
import type { AnnotationSide } from "@pierre/diffs/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildDraftTarget,
  isSameDraftTarget,
  resolvePointerLineTarget,
} from "./diff-panel-content.helpers";
import type { DiffCommentDraft } from "./diffCommentStore";

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

type DragSelection = {
  pointerId: number;
  fileKey: string;
  filePath: string;
  anchor: { side: AnnotationSide; lineNumber: number };
  current: { side: AnnotationSide; lineNumber: number };
  didDrag: boolean;
};

export function useDiffCommentDrafting({
  draftComment,
  setDraftComment,
}: {
  draftComment: DiffCommentDraft | null;
  setDraftComment: React.Dispatch<React.SetStateAction<DiffCommentDraft | null>>;
}) {
  const [dragSelectionRange, setDragSelectionRange] = useState<SelectedLineRange | null>(null);
  const fileInteractionHandlersRef = useRef(new Map<string, FileInteractionHandlers>());
  const dragSelectionRef = useRef<DragSelection | null>(null);
  const dragUserSelectResetRef = useRef<(() => void) | null>(null);
  const suppressNextLineClickRef = useRef(false);

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
    [setDraftComment],
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

  const getFileInteractionHandlers = useCallback(
    (fileKey: string, filePath: string) => {
      const cached = fileInteractionHandlersRef.current.get(fileKey);
      if (cached) {
        return cached;
      }

      const next = {
        onLineClick: ({ lineNumber, annotationSide, event }) => {
          if (suppressNextLineClickRef.current) {
            suppressNextLineClickRef.current = false;
            event.preventDefault();
            return;
          }
          event.preventDefault();
          openDraftComment(fileKey, filePath, annotationSide, lineNumber);
        },
        onLineNumberClick: ({ lineNumber, annotationSide, event }) => {
          if (suppressNextLineClickRef.current) {
            suppressNextLineClickRef.current = false;
            event.preventDefault();
            return;
          }
          event.preventDefault();
          openDraftComment(fileKey, filePath, annotationSide, lineNumber);
        },
      } satisfies FileInteractionHandlers;

      fileInteractionHandlersRef.current.set(fileKey, next);
      return next;
    },
    [openDraftComment],
  );

  const handleFilePointerDownCapture = useCallback(
    (event: React.PointerEvent<HTMLDivElement>, fileKey: string, filePath: string) => {
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
    },
    [disableDocumentSelection, updateDragSelectionRange],
  );

  const getSelectedLinesForFile = useCallback(
    (fileKey: string, draftSelectedLines: SelectedLineRange | null) => {
      if (dragSelectionRef.current?.fileKey === fileKey && dragSelectionRange) {
        return dragSelectionRange;
      }

      if (draftComment?.fileKey === fileKey) {
        return draftSelectedLines;
      }

      return null;
    },
    [dragSelectionRange, draftComment?.fileKey],
  );

  const clearDragSelection = useCallback(() => {
    dragSelectionRef.current = null;
    setDragSelectionRange(null);
  }, []);

  return {
    clearDragSelection,
    dragSelectionRange,
    getFileInteractionHandlers,
    getSelectedLinesForFile,
    handleFilePointerDownCapture,
    openDraftComment,
  };
}
