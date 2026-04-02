import { parsePatchFiles } from "@pierre/diffs";
import type { TurnDiffFile } from "../../shared/desktop-contracts";

function normalizeFilePath(pathValue: string) {
  if (pathValue.startsWith("a/") || pathValue.startsWith("b/")) {
    return pathValue.slice(2);
  }

  return pathValue;
}

export function parseTurnDiffFilesFromUnifiedDiff(diff: string): TurnDiffFile[] {
  const normalized = diff.replace(/\r\n/g, "\n").trim();
  if (normalized.length === 0) {
    return [];
  }

  const parsedPatches = parsePatchFiles(normalized);

  return parsedPatches
    .flatMap((patch) =>
      patch.files.map((file) => ({
        path: normalizeFilePath(file.name ?? file.prevName ?? ""),
        kind: "modified",
        additions: file.hunks.reduce((total, hunk) => total + hunk.additionLines, 0),
        deletions: file.hunks.reduce((total, hunk) => total + hunk.deletionLines, 0),
      })),
    )
    .filter((file) => file.path.length > 0)
    .toSorted((left, right) => left.path.localeCompare(right.path, undefined, { numeric: true }));
}
