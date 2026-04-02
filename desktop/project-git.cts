import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import type { ProjectGitState } from "../shared/desktop-contracts";

const execFile = promisify(execFileCallback);

function parseShortStat(output: string) {
  const insertionsMatch = output.match(/(\d+)\s+insertions?\(\+\)/);
  const deletionsMatch = output.match(/(\d+)\s+deletions?\(-\)/);

  return {
    insertions: insertionsMatch ? Number.parseInt(insertionsMatch[1], 10) : 0,
    deletions: deletionsMatch ? Number.parseInt(deletionsMatch[1], 10) : 0,
  };
}

async function runGit(projectId: string, args: string[]) {
  return execFile("git", args, {
    cwd: projectId,
    timeout: 3_000,
    maxBuffer: 1024 * 128,
  });
}

async function getBranch(projectId: string) {
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
    const { stdout } = await runGit(projectId, ["rev-parse", "--short", "HEAD"]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function getDiffStats(projectId: string) {
  try {
    const { stdout } = await runGit(projectId, ["diff", "--shortstat", "HEAD", "--"]);
    return parseShortStat(stdout);
  } catch {
    return { insertions: 0, deletions: 0 };
  }
}

export async function loadProjectGitState(projectId: string): Promise<ProjectGitState> {
  try {
    const { stdout } = await runGit(projectId, ["rev-parse", "--is-inside-work-tree"]);
    if (stdout.trim() !== "true") {
      throw new Error("not a git repo");
    }
  } catch {
    return {
      projectId,
      isGitRepo: false,
      branch: null,
      insertions: 0,
      deletions: 0,
    };
  }

  const [branch, stats] = await Promise.all([getBranch(projectId), getDiffStats(projectId)]);

  return {
    projectId,
    isGitRepo: true,
    branch,
    insertions: stats.insertions,
    deletions: stats.deletions,
  };
}
