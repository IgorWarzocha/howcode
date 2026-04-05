import type { AnnotationSide } from "@pierre/diffs/react";
import type { DiffCommentDraft } from "./diffCommentStore";

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
