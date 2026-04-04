import type { SavedDiffComment } from "./diffCommentStore";

function formatCommentLocation(comment: SavedDiffComment) {
  const endLineNumber = comment.endLineNumber ?? comment.lineNumber;
  const endSide = comment.endSide ?? comment.side;

  if (comment.side === endSide) {
    const start = Math.min(comment.lineNumber, endLineNumber);
    const end = Math.max(comment.lineNumber, endLineNumber);
    const sideLabel = comment.side === "deletions" ? "old" : "new";

    return start === end
      ? `${comment.filePath}:${start} (${sideLabel} side)`
      : `${comment.filePath}:${start}-${end} (${sideLabel} side)`;
  }

  const startSideLabel = comment.side === "deletions" ? "old" : "new";
  const endSideLabel = endSide === "deletions" ? "old" : "new";
  return `${comment.filePath}:${comment.lineNumber} (${startSideLabel} side) → ${endLineNumber} (${endSideLabel} side)`;
}

export function buildDiffCommentPrompt({
  comments,
}: {
  comments: SavedDiffComment[];
}) {
  const intro = "Address these review comments from the current worktree diff.";

  const bullets = comments
    .map((comment, index) => {
      const location = formatCommentLocation(comment);
      return `${index + 1}. ${location}\n   ${comment.body.trim()}`;
    })
    .join("\n\n");

  return `${intro}\n\nMake the requested code changes. When you're done, briefly summarize what you changed.\n\nComments:\n${bullets}`;
}
