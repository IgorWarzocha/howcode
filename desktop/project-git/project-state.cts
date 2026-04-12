import type { ProjectGitState } from "../../shared/desktop-contracts.ts";
import { formatGitCommandError, hasHeadCommit, runGit, runGitWithOptions } from "./git-runner.cts";
import { loadWorktreeSnapshot } from "./worktree-snapshot.cts";

function parseStatusSummary(output: string) {
  let fileCount = 0;
  let stagedFileCount = 0;
  let unstagedFileCount = 0;

  for (const line of output.split("\n")) {
    if (!line || line.startsWith("## ")) {
      continue;
    }

    fileCount += 1;

    if (line.startsWith("??")) {
      unstagedFileCount += 1;
      continue;
    }

    const stagedStatus = line[0] ?? " ";
    const unstagedStatus = line[1] ?? " ";

    if (stagedStatus !== " ") {
      stagedFileCount += 1;
    }

    if (unstagedStatus !== " ") {
      unstagedFileCount += 1;
    }
  }

  return {
    fileCount,
    stagedFileCount,
    unstagedFileCount,
  };
}

export async function isGitRepository(projectId: string) {
  try {
    const { stdout } = await runGit(projectId, ["rev-parse", "--is-inside-work-tree"]);
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}

async function getStatusSummary(projectId: string) {
  try {
    const { stdout } = await runGitWithOptions(projectId, ["status", "--short", "--branch"], {
      timeout: 10_000,
      maxBuffer: 1024 * 1024 * 4,
    });
    return parseStatusSummary(stdout);
  } catch {
    return {
      fileCount: 0,
      stagedFileCount: 0,
      unstagedFileCount: 0,
    };
  }
}

export async function getOriginUrl(projectId: string) {
  try {
    const { stdout } = await runGit(projectId, ["remote", "get-url", "origin"]);
    const originUrl = stdout.trim();
    return originUrl.length > 0 ? originUrl : null;
  } catch {
    return null;
  }
}

function deriveOriginName(originUrl: string | null) {
  if (!originUrl) {
    return null;
  }

  const normalizedUrl = originUrl.replace(/\/$/, "");
  const parts = normalizedUrl.split(/[/:]/).filter((part) => part.length > 0);
  const lastPart = parts.at(-1) ?? originUrl;
  return lastPart.replace(/\.git$/i, "") || "origin";
}

export async function getBranch(projectId: string) {
  try {
    const { stdout } = await runGit(projectId, ["branch", "--show-current"]);
    const branch = stdout.trim();
    if (branch) {
      return branch;
    }
  } catch {
    // Fallback below.
  }

  try {
    if (await hasHeadCommit(projectId)) {
      const { stdout } = await runGit(projectId, ["rev-parse", "--short", "HEAD"]);
      return stdout.trim() || null;
    }
  } catch {
    return null;
  }

  return null;
}

export async function loadProjectGitState(projectId: string): Promise<ProjectGitState> {
  if (!(await isGitRepository(projectId))) {
    return {
      projectId,
      isGitRepo: false,
      branch: null,
      fileCount: 0,
      stagedFileCount: 0,
      unstagedFileCount: 0,
      insertions: 0,
      deletions: 0,
      hasOrigin: false,
      originName: null,
      originUrl: null,
    };
  }

  const [branch, statusSummary, originUrl, snapshot] = await Promise.all([
    getBranch(projectId),
    getStatusSummary(projectId),
    getOriginUrl(projectId),
    loadWorktreeSnapshot(projectId).catch((error) => {
      console.warn(
        `Failed to load worktree snapshot for ${projectId}: ${formatGitCommandError(error)}`,
      );
      return null;
    }),
  ]);

  const fileCount = snapshot?.fileCount ?? statusSummary.fileCount;
  const insertions = snapshot?.insertions ?? 0;
  const deletions = snapshot?.deletions ?? 0;

  return {
    projectId,
    isGitRepo: true,
    branch,
    fileCount,
    stagedFileCount: statusSummary.stagedFileCount,
    unstagedFileCount: statusSummary.unstagedFileCount,
    insertions,
    deletions,
    hasOrigin: originUrl !== null,
    originName: deriveOriginName(originUrl),
    originUrl,
  };
}
