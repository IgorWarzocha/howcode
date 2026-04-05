import { parsePatchFiles } from "@pierre/diffs";
import type { FileDiffMetadata } from "@pierre/diffs/react";
import type { RenderablePatch } from "./diff-panel-content.types";
import { buildPatchCacheKey } from "./diff-rendering";

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
