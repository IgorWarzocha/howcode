import type { GitOpsMode } from "./desktop-settings-contracts";

export type ProjectDiffRenderMode = "stacked" | "split";
export type ProjectDiffDefaultBaseline =
  | { kind: "head" }
  | { kind: "previous" }
  | { kind: "yesterday" }
  | { kind: "main-branch" }
  | { kind: "dev-branch" };

export type ProjectGitState = {
  projectId: string;
  isGitRepo: boolean;
  branch: string | null;
  fileCount: number;
  stagedFileCount: number;
  unstagedFileCount: number;
  insertions: number;
  deletions: number;
  hasOrigin: boolean;
  originName: string | null;
  originUrl: string | null;
  gitOpsModeOverride: GitOpsMode | null;
};

export type ProjectDiffBaseline =
  | { kind: "head" }
  | { kind: "previous" }
  | { kind: "last-opened"; rev: string; capturedAt?: string | null }
  | { kind: "yesterday" }
  | { kind: "main-branch" }
  | { kind: "dev-branch" }
  | { kind: "commit"; sha: string };

export type ProjectDiffPreferences = {
  baseline: ProjectDiffBaseline | null;
  renderMode: ProjectDiffRenderMode | null;
};

export type ProjectDiffResolvedBaseline = {
  kind: ProjectDiffBaseline["kind"];
  rev: string;
  label: string;
  commitSha: string | null;
  shortSha: string | null;
  subject: string | null;
  committedAt: string | null;
  capturedAt: string | null;
};

export type ProjectCommitEntry = {
  sha: string;
  shortSha: string;
  subject: string;
  authorName: string;
  authorEmail: string;
  authoredAt: string;
  committedAt: string;
  decorations: string[];
  isHead: boolean;
};

export type ProjectDiffResult = {
  projectId: string;
  diff: string;
  fileCount: number;
  insertions: number;
  deletions: number;
  baseline: ProjectDiffBaseline;
  resolvedBaseline: ProjectDiffResolvedBaseline;
};

export type ProjectDiffStatsResult = {
  projectId: string;
  fileCount: number;
  insertions: number;
  deletions: number;
  baseline: ProjectDiffBaseline;
  resolvedBaseline: ProjectDiffResolvedBaseline;
};
