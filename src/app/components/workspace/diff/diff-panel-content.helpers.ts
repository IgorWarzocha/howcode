import { parsePatchFiles } from "@pierre/diffs";
import type { FileDiffMetadata } from "@pierre/diffs/react";
import { buildPatchCacheKey } from "./diff-rendering";

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

export const DIFF_PANEL_UNSAFE_CSS = `
[data-diffs-header],
[data-diff],
[data-file],
[data-error-wrapper],
[data-virtualizer-buffer] {
  --diffs-bg: color-mix(in srgb, var(--panel) 88%, var(--workspace)) !important;
  --diffs-light-bg: color-mix(in srgb, var(--panel) 88%, var(--workspace)) !important;
  --diffs-dark-bg: color-mix(in srgb, var(--panel) 88%, var(--workspace)) !important;
  --diffs-token-light-bg: transparent;
  --diffs-token-dark-bg: transparent;
  --diffs-bg-context-override: color-mix(in srgb, var(--workspace) 96%, var(--text));
  --diffs-bg-hover-override: color-mix(in srgb, var(--workspace) 92%, var(--text));
  --diffs-bg-separator-override: color-mix(in srgb, var(--workspace) 94%, var(--text));
  --diffs-bg-buffer-override: color-mix(in srgb, var(--workspace) 90%, var(--text));
  --diffs-bg-addition-override: color-mix(in srgb, var(--workspace) 90%, var(--green));
  --diffs-bg-addition-number-override: color-mix(in srgb, var(--workspace) 84%, var(--green));
  --diffs-bg-addition-hover-override: color-mix(in srgb, var(--workspace) 82%, var(--green));
  --diffs-bg-addition-emphasis-override: color-mix(in srgb, var(--workspace) 76%, var(--green));
  --diffs-bg-deletion-override: color-mix(in srgb, var(--workspace) 90%, #d06b72);
  --diffs-bg-deletion-number-override: color-mix(in srgb, var(--workspace) 84%, #d06b72);
  --diffs-bg-deletion-hover-override: color-mix(in srgb, var(--workspace) 82%, #d06b72);
  --diffs-bg-deletion-emphasis-override: color-mix(in srgb, var(--workspace) 76%, #d06b72);
  background-color: var(--diffs-bg) !important;
}

[data-file-info] {
  background-color: color-mix(in srgb, var(--panel) 94%, var(--text)) !important;
  border-block-color: var(--border) !important;
  color: var(--text) !important;
}

[data-diffs-header] {
  position: sticky !important;
  top: 0;
  z-index: 4;
  background-color: color-mix(in srgb, var(--panel) 94%, var(--text)) !important;
  border-bottom: 1px solid var(--border) !important;
}

[data-title] {
  cursor: pointer;
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
