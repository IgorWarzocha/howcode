import type { DesktopActionResult } from "../../../desktop/types";
import type { SavedDiffComment } from "../diff/diffCommentStore";

export type GitOpsCommentCard = {
  id: string;
  filePath: string;
  fileName: string;
  linesLabel: string;
};

export function getActionResultMessage(result: DesktopActionResult | null) {
  return typeof result?.result?.message === "string" ? result.result.message : null;
}

export function getActionResultCommitted(result: DesktopActionResult | null) {
  return result?.result?.committed === true;
}

export function getActionResultPreviewed(result: DesktopActionResult | null) {
  return result?.result?.previewed === true;
}

export function getActionResultError(result: DesktopActionResult | null) {
  return typeof result?.result?.error === "string" ? result.result.error : null;
}

export function getCommentLinesLabel(comment: SavedDiffComment) {
  const endLineNumber = comment.endLineNumber ?? comment.lineNumber;
  const endSide = comment.endSide ?? comment.side;

  if (comment.side === endSide) {
    const start = Math.min(comment.lineNumber, endLineNumber);
    const end = Math.max(comment.lineNumber, endLineNumber);
    return start === end ? `Ln ${start}` : `Ln ${start}:${end}`;
  }

  return `Ln ${comment.lineNumber}:${endLineNumber}`;
}

export function getCommentFileName(filePath: string) {
  const segments = filePath.split("/");
  return segments[segments.length - 1] || filePath;
}

export function buildGitOpsCommentCards(diffComments: SavedDiffComment[]): GitOpsCommentCard[] {
  return diffComments.map((comment) => ({
    id: comment.id,
    filePath: comment.filePath,
    fileName: getCommentFileName(comment.filePath),
    linesLabel: getCommentLinesLabel(comment),
  }));
}
