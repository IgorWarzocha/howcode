import type {
  ProjectDiffBaseline,
  ProjectDiffResolvedBaseline,
} from "../../shared/desktop-contracts.ts";
import { runGitWithOptions } from "./git-runner.cts";
import { getProjectCommitEntry, resolveCommitRevision } from "./project-commits.cts";
import { isGitRepository } from "./project-state.cts";
import { EMPTY_TREE_OID, captureWorktreeTree } from "./worktree-snapshot.cts";

type LastOpenedBaselineState = {
  rev: string;
  capturedAt: string;
};

const lastOpenedBaselineByProject = new Map<string, LastOpenedBaselineState>();

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
  kind: Extract<ProjectDiffBaseline["kind"], "head" | "before-today" | "commit">,
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

async function resolveBeforeTodayBaseline(projectId: string): Promise<ProjectDiffResolvedBaseline> {
  const { stdout } = await runGitWithOptions(
    projectId,
    ["rev-list", "-1", `--before=${formatLocalMidnightGitTimestamp()}`, "HEAD"],
    {
      timeout: 10_000,
      maxBuffer: 1024 * 128,
    },
  );

  const commitSha = stdout.trim();
  if (commitSha.length === 0) {
    throw new Error("No commit exists from before today.");
  }

  const entry = await getProjectCommitEntry(projectId, commitSha);
  if (!entry) {
    throw new Error("Could not resolve the commit from before today.");
  }

  return toResolvedCommitBaseline("before-today", entry);
}

async function resolveChosenCommitBaseline(
  projectId: string,
  sha: string,
): Promise<ProjectDiffResolvedBaseline> {
  const resolvedSha = await resolveCommitRevision(projectId, sha);
  if (!resolvedSha) {
    throw new Error(`Could not find commit ${sha}.`);
  }

  const entry = await getProjectCommitEntry(projectId, resolvedSha);
  if (!entry) {
    throw new Error(`Could not load commit ${sha}.`);
  }

  return toResolvedCommitBaseline("commit", entry);
}

function resolveLastOpenedBaseline(projectId: string): ProjectDiffResolvedBaseline {
  const baseline = lastOpenedBaselineByProject.get(projectId);
  if (!baseline) {
    throw new Error("No diff baseline has been captured for this project yet.");
  }

  return {
    kind: "last-opened",
    rev: baseline.rev,
    label: "Last opened",
    commitSha: null,
    shortSha: null,
    subject: null,
    committedAt: null,
    capturedAt: baseline.capturedAt,
  };
}

export async function captureProjectDiffBaseline(
  projectId: string,
): Promise<ProjectDiffResolvedBaseline | null> {
  if (!(await isGitRepository(projectId))) {
    return null;
  }

  const rev = await captureWorktreeTree(projectId);
  const capturedAt = new Date().toISOString();
  lastOpenedBaselineByProject.set(projectId, { rev, capturedAt });

  return {
    kind: "last-opened",
    rev,
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
    case "last-opened":
      return resolveLastOpenedBaseline(projectId);
    case "before-today":
      return resolveBeforeTodayBaseline(projectId);
    case "commit":
      return resolveChosenCommitBaseline(projectId, requestedBaseline.sha);
    default:
      return resolveHeadBaseline(projectId);
  }
}
