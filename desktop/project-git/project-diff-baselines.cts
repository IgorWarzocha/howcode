import { createHash } from "node:crypto";
import type {
  ProjectDiffBaseline,
  ProjectDiffResolvedBaseline,
} from "../../shared/desktop-contracts.ts";
import { runGitWithOptions } from "./git-runner.cts";
import { hasHeadCommit, runGit } from "./git-runner.cts";
import { getProjectCommitEntry, resolveCommitRevision } from "./project-commits.cts";
import { isGitRepository } from "./project-state.cts";
import { EMPTY_TREE_OID, captureWorktreeTree } from "./worktree-snapshot.cts";

function getLastOpenedBaselineRef(projectId: string, capturedAt: string) {
  const projectHash = createHash("sha1").update(projectId).digest("hex");
  const baselineHash = createHash("sha1").update(`${projectId}:${capturedAt}`).digest("hex");
  return `refs/howcode/diff-baselines/${projectHash}/${baselineHash}`;
}

function formatLocalMidnightGitTimestamp(date = new Date()) {
  const localMidnight = new Date(date);
  localMidnight.setHours(0, 0, 0, 0);

  const year = localMidnight.getFullYear();
  const month = `${localMidnight.getMonth() + 1}`.padStart(2, "0");
  const day = `${localMidnight.getDate()}`.padStart(2, "0");
  const hours = `${localMidnight.getHours()}`.padStart(2, "0");
  const minutes = `${localMidnight.getMinutes()}`.padStart(2, "0");
  const seconds = `${localMidnight.getSeconds()}`.padStart(2, "0");
  const timezoneOffsetMinutes = -localMidnight.getTimezoneOffset();
  const offsetSign = timezoneOffsetMinutes >= 0 ? "+" : "-";
  const absoluteOffsetMinutes = Math.abs(timezoneOffsetMinutes);
  const offsetHours = `${Math.floor(absoluteOffsetMinutes / 60)}`.padStart(2, "0");
  const offsetMinutes = `${absoluteOffsetMinutes % 60}`.padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} ${offsetSign}${offsetHours}${offsetMinutes}`;
}

function toResolvedCommitBaseline(
  kind: Extract<
    ProjectDiffBaseline["kind"],
    "head" | "previous" | "yesterday" | "main-branch" | "dev-branch" | "commit"
  >,
  entry: Awaited<ReturnType<typeof getProjectCommitEntry>>,
): ProjectDiffResolvedBaseline {
  return {
    kind,
    rev: entry?.sha ?? EMPTY_TREE_OID,
    label: entry?.subject ?? (kind === "head" ? "HEAD" : "Commit"),
    commitSha: entry?.sha ?? null,
    shortSha: entry?.shortSha ?? null,
    subject: entry?.subject ?? null,
    committedAt: entry?.committedAt ?? null,
    capturedAt: null,
  };
}

async function resolveFirstExistingRef(projectId: string, candidateRefs: string[]) {
  for (const ref of candidateRefs) {
    const resolvedRef = await resolveCommitRevision(projectId, ref);
    if (resolvedRef) {
      return { ref, resolvedRef };
    }
  }

  return null;
}

async function resolveMergeBaseRevision(projectId: string, targetRev: string) {
  if (!(await hasHeadCommit(projectId))) {
    return EMPTY_TREE_OID;
  }

  try {
    const { stdout } = await runGitWithOptions(projectId, ["merge-base", "HEAD", targetRev], {
      timeout: 10_000,
      maxBuffer: 1024 * 128,
    });

    const mergeBaseRev = stdout.trim();
    return mergeBaseRev.length > 0 ? mergeBaseRev : null;
  } catch {
    return null;
  }
}

async function resolveNamedBranchBaseline(
  projectId: string,
  options: {
    kind: Extract<ProjectDiffBaseline["kind"], "main-branch" | "dev-branch">;
    label: string;
    candidateRefs: string[];
  },
): Promise<ProjectDiffResolvedBaseline> {
  const resolvedTarget = await resolveFirstExistingRef(projectId, options.candidateRefs);
  if (!resolvedTarget) {
    throw new Error(`Could not find ${options.label.toLowerCase()}.`);
  }

  const mergeBaseRev = await resolveMergeBaseRevision(projectId, resolvedTarget.resolvedRef);
  if (!mergeBaseRev) {
    throw new Error(`Could not determine merge base with ${options.label.toLowerCase()}.`);
  }

  if (mergeBaseRev === EMPTY_TREE_OID) {
    return {
      kind: options.kind,
      rev: EMPTY_TREE_OID,
      label: options.label,
      commitSha: null,
      shortSha: null,
      subject: null,
      committedAt: null,
      capturedAt: null,
    };
  }

  const entry = await getProjectCommitEntry(projectId, mergeBaseRev);
  if (!entry) {
    throw new Error(`Could not load merge base for ${options.label.toLowerCase()}.`);
  }

  return {
    ...toResolvedCommitBaseline(options.kind, entry),
    label: options.label,
  };
}

async function resolveHeadBaseline(projectId: string): Promise<ProjectDiffResolvedBaseline> {
  const entry = await getProjectCommitEntry(projectId, "HEAD");
  if (!entry) {
    return {
      kind: "head",
      rev: EMPTY_TREE_OID,
      label: "Initial state",
      commitSha: null,
      shortSha: null,
      subject: null,
      committedAt: null,
      capturedAt: null,
    };
  }

  return toResolvedCommitBaseline("head", entry);
}

async function resolvePreviousCommitBaseline(
  projectId: string,
): Promise<ProjectDiffResolvedBaseline> {
  const entry = await getProjectCommitEntry(projectId, "HEAD^");
  if (!entry) {
    return {
      kind: "previous",
      rev: EMPTY_TREE_OID,
      label: "Initial state",
      commitSha: null,
      shortSha: null,
      subject: null,
      committedAt: null,
      capturedAt: null,
    };
  }

  return {
    ...toResolvedCommitBaseline("previous", entry),
    label: "Previous commit",
  };
}

async function resolveYesterdayBaseline(projectId: string): Promise<ProjectDiffResolvedBaseline> {
  if (!(await hasHeadCommit(projectId))) {
    return {
      kind: "yesterday",
      rev: EMPTY_TREE_OID,
      label: "Initial state",
      commitSha: null,
      shortSha: null,
      subject: null,
      committedAt: null,
      capturedAt: null,
    };
  }

  let stdout = "";

  try {
    ({ stdout } = await runGitWithOptions(
      projectId,
      ["rev-list", "-1", `--before=${formatLocalMidnightGitTimestamp()}`, "HEAD"],
      {
        timeout: 10_000,
        maxBuffer: 1024 * 128,
      },
    ));
  } catch {
    stdout = "";
  }

  const commitSha = stdout.trim();
  if (commitSha.length === 0) {
    return {
      kind: "yesterday",
      rev: EMPTY_TREE_OID,
      label: "Initial state",
      commitSha: null,
      shortSha: null,
      subject: null,
      committedAt: null,
      capturedAt: null,
    };
  }

  const entry = await getProjectCommitEntry(projectId, commitSha);
  if (!entry) {
    throw new Error("Could not resolve the commit for yesterday.");
  }

  return toResolvedCommitBaseline("yesterday", entry);
}

async function resolveMainBranchBaseline(projectId: string): Promise<ProjectDiffResolvedBaseline> {
  return resolveNamedBranchBaseline(projectId, {
    kind: "main-branch",
    label: "Main branch",
    candidateRefs: [
      "refs/heads/main",
      "refs/remotes/origin/main",
      "refs/heads/master",
      "refs/remotes/origin/master",
    ],
  });
}

async function resolveDevBranchBaseline(projectId: string): Promise<ProjectDiffResolvedBaseline> {
  return resolveNamedBranchBaseline(projectId, {
    kind: "dev-branch",
    label: "Dev branch",
    candidateRefs: ["refs/heads/dev", "refs/remotes/origin/dev"],
  });
}

async function resolveChosenCommitBaseline(
  projectId: string,
  sha: string,
): Promise<ProjectDiffResolvedBaseline> {
  const trimmedSha = sha.trim();
  if (trimmedSha.length === 0) {
    throw new Error("Could not find the selected commit.");
  }

  const resolvedSha = await resolveCommitRevision(projectId, trimmedSha);
  if (!resolvedSha) {
    throw new Error(`Could not find commit ${trimmedSha}.`);
  }

  const entry = await getProjectCommitEntry(projectId, resolvedSha);
  if (!entry) {
    throw new Error(`Could not load commit ${trimmedSha}.`);
  }

  return toResolvedCommitBaseline("commit", entry);
}

async function resolveLastOpenedBaseline(
  projectId: string,
  baseline: Extract<ProjectDiffBaseline, { kind: "last-opened" }>,
): Promise<ProjectDiffResolvedBaseline> {
  if (baseline.rev.trim().length === 0) {
    throw new Error("No diff baseline has been captured for this project yet.");
  }

  let resolvedRev = "";

  try {
    ({ stdout: resolvedRev } = await runGitWithOptions(
      projectId,
      ["rev-parse", "--verify", baseline.rev],
      {
        timeout: 10_000,
        maxBuffer: 1024 * 128,
      },
    ));
  } catch {
    resolvedRev = "";
  }

  if (resolvedRev.trim().length === 0) {
    return resolveHeadBaseline(projectId);
  }

  return {
    kind: "last-opened",
    rev: resolvedRev.trim(),
    label: "Last opened",
    commitSha: null,
    shortSha: null,
    subject: null,
    committedAt: null,
    capturedAt: baseline.capturedAt ?? null,
  };
}

export async function captureProjectDiffBaseline(
  projectId: string,
): Promise<ProjectDiffResolvedBaseline | null> {
  if (!(await isGitRepository(projectId))) {
    return null;
  }

  const treeRev = await captureWorktreeTree(projectId);
  const capturedAt = new Date().toISOString();
  const baselineRef = getLastOpenedBaselineRef(projectId, capturedAt);
  const repositoryHasHead = await hasHeadCommit(projectId);

  const commitArgs = [
    "commit-tree",
    treeRev,
    ...(repositoryHasHead ? ["-p", "HEAD"] : []),
    "-m",
    `howcode diff baseline capturedAt=${capturedAt}`,
  ];

  const { stdout } = await runGitWithOptions(projectId, commitArgs, {
    timeout: 10_000,
    maxBuffer: 1024 * 128,
  });
  const commitRev = stdout.trim();

  if (commitRev.length > 0) {
    await runGit(projectId, ["update-ref", baselineRef, commitRev]);
  }

  return {
    kind: "last-opened",
    rev: commitRev.length > 0 ? baselineRef : EMPTY_TREE_OID,
    label: "Last opened",
    commitSha: null,
    shortSha: null,
    subject: null,
    committedAt: null,
    capturedAt,
  };
}

export async function resolveProjectDiffBaseline(
  projectId: string,
  baseline?: ProjectDiffBaseline | null,
): Promise<ProjectDiffResolvedBaseline> {
  if (!(await isGitRepository(projectId))) {
    throw new Error("This project is not a git repository.");
  }

  const requestedBaseline = baseline ?? { kind: "head" };

  switch (requestedBaseline.kind) {
    case "head":
      return resolveHeadBaseline(projectId);
    case "previous":
      return resolvePreviousCommitBaseline(projectId);
    case "last-opened":
      return resolveLastOpenedBaseline(projectId, requestedBaseline);
    case "yesterday":
      return resolveYesterdayBaseline(projectId);
    case "main-branch":
      return resolveMainBranchBaseline(projectId);
    case "dev-branch":
      return resolveDevBranchBaseline(projectId);
    case "commit":
      return resolveChosenCommitBaseline(projectId, requestedBaseline.sha);
    default:
      return resolveHeadBaseline(projectId);
  }
}
