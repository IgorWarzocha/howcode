import type {
  ProjectCommitEntry,
  ProjectDiffBaseline,
  ProjectDiffResolvedBaseline,
} from "../../../desktop/types";

export const defaultDiffBaseline = { kind: "head" } as const satisfies ProjectDiffBaseline;

export function getDiffBaselineLabel(
  baseline: ProjectDiffBaseline | null | undefined,
  commits: ProjectCommitEntry[] = [],
) {
  if (baseline?.kind === "before-today") {
    return "yesterday";
  }

  if (baseline?.kind === "main-branch") {
    return "main branch";
  }

  if (baseline?.kind === "last-opened") {
    return "last opened";
  }

  if (baseline?.kind === "commit") {
    const selectedCommit = commits.find((commit) => commit.sha === baseline.sha);
    return (
      selectedCommit?.subject?.trim() ||
      selectedCommit?.shortSha ||
      baseline.sha.slice(0, 7) ||
      "selected commit"
    );
  }

  return "last commit";
}

export function getResolvedDiffBaselineLabel(
  baseline: ProjectDiffBaseline | null | undefined,
  resolvedBaseline: ProjectDiffResolvedBaseline | null | undefined,
) {
  switch (baseline?.kind ?? "head") {
    case "before-today":
      return "yesterday";
    case "main-branch":
      return "main branch";
    case "last-opened":
      return "last opened";
    case "commit":
      return resolvedBaseline?.subject?.trim() || resolvedBaseline?.shortSha || "that commit";
    default:
      return "last commit";
  }
}
