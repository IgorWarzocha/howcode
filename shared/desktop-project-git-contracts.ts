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
};

export type ProjectDiffBaseline =
  | { kind: "head" }
  | { kind: "previous" }
  | { kind: "last-opened"; rev: string; capturedAt?: string | null }
  | { kind: "yesterday" }
  | { kind: "main-branch" }
  | { kind: "dev-branch" }
  | { kind: "commit"; sha: string };

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
