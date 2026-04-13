import type {
  ProjectCommitEntry,
  ProjectDiffBaseline,
  ProjectDiffResolvedBaseline,
} from "../../../desktop/types";

export const defaultDiffBaseline = { kind: "head" } as const satisfies ProjectDiffBaseline;

export function getDiffBaselinePrefix(baseline: ProjectDiffBaseline | null | undefined) {
  return baseline?.kind === "main-branch" ? "from" : "since";
}

export function getDiffBaselineLabel(
  baseline: ProjectDiffBaseline | null | undefined,
  commits: ProjectCommitEntry[] = [],
) {
  if (baseline?.kind === "previous") {
    return "prev commit";
  }

  if (baseline?.kind === "yesterday") {
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
    return selectedCommit?.shortSha || baseline.sha.slice(0, 7) || "selected commit";
  }

  return "last commit";
}

export function getResolvedDiffBaselineLabel(
  baseline: ProjectDiffBaseline | null | undefined,
  resolvedBaseline: ProjectDiffResolvedBaseline | null | undefined,
) {
  switch (baseline?.kind ?? "head") {
    case "previous":
      return "prev commit";
    case "yesterday":
      return "yesterday";
    case "main-branch":
      return "main branch";
    case "last-opened":
      return "last opened";
    case "commit":
      return (
        resolvedBaseline?.shortSha || resolvedBaseline?.commitSha?.slice(0, 7) || "that commit"
      );
    default:
      return "last commit";
  }
}
