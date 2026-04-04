import type { SavedDiffComment } from "./diffCommentStore";

export function buildDiffCommentPrompt({
  comments,
  selectedTurnCount,
}: {
  comments: SavedDiffComment[];
  selectedTurnCount: number | null;
}) {
  const intro =
    selectedTurnCount === null
      ? "Address these review comments from the current diff."
      : `Address these review comments from diff turn ${selectedTurnCount}.`;

  const bullets = comments
    .map((comment, index) => {
      const location = `${comment.filePath}:${comment.lineNumber} (${comment.side === "deletions" ? "old" : "new"} side)`;
      return `${index + 1}. ${location}\n   ${comment.body.trim()}`;
    })
    .join("\n\n");

  return `${intro}\n\nMake the requested code changes. When you're done, briefly summarize what you changed.\n\nComments:\n${bullets}`;
}
