import { execFile as execFileCallback } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const CHECKPOINT_REFS_PREFIX = "refs/howcode/checkpoints";

function runGit(cwd: string, args: string[], env?: NodeJS.ProcessEnv) {
  return execFile("git", args, {
    cwd,
    env: env ? { ...process.env, ...env } : process.env,
    timeout: 10_000,
    maxBuffer: 1024 * 1024 * 4,
  });
}

async function resolveHeadCommit(cwd: string) {
  try {
    const { stdout } = await runGit(cwd, ["rev-parse", "--verify", "--quiet", "HEAD^{commit}"]);
    const commit = stdout.trim();
    return commit.length > 0 ? commit : null;
  } catch {
    return null;
  }
}

async function hasHeadCommit(cwd: string) {
  try {
    await runGit(cwd, ["rev-parse", "--verify", "HEAD"]);
    return true;
  } catch {
    return false;
  }
}

async function resolveCheckpointCommit(cwd: string, checkpointRef: string) {
  try {
    const { stdout } = await runGit(cwd, [
      "rev-parse",
      "--verify",
      "--quiet",
      `${checkpointRef}^{commit}`,
    ]);
    const commit = stdout.trim();
    return commit.length > 0 ? commit : null;
  } catch {
    return null;
  }
}

export function checkpointRefForSessionTurn(sessionPath: string, turnCount: number) {
  const sessionKey = createHash("sha256").update(sessionPath).digest("hex").slice(0, 24);
  return `${CHECKPOINT_REFS_PREFIX}/${sessionKey}/turn/${turnCount}`;
}

export async function isGitRepository(cwd: string) {
  try {
    const { stdout } = await runGit(cwd, ["rev-parse", "--is-inside-work-tree"]);
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}

export async function hasCheckpointRef(cwd: string, checkpointRef: string) {
  return (await resolveCheckpointCommit(cwd, checkpointRef)) !== null;
}

export async function captureCheckpoint(input: { cwd: string; checkpointRef: string }) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "howcode-checkpoint-"));

  try {
    const tempIndexPath = path.join(tempDir, `index-${randomUUID()}`);
    const commitEnv: NodeJS.ProcessEnv = {
      GIT_INDEX_FILE: tempIndexPath,
      GIT_AUTHOR_NAME: "Howcode",
      GIT_AUTHOR_EMAIL: "howcode@users.noreply.github.com",
      GIT_COMMITTER_NAME: "Howcode",
      GIT_COMMITTER_EMAIL: "howcode@users.noreply.github.com",
    };

    if (await hasHeadCommit(input.cwd)) {
      await runGit(input.cwd, ["read-tree", "HEAD"], commitEnv);
    }

    await runGit(input.cwd, ["add", "-A", "--", "."], commitEnv);
    const { stdout: treeStdout } = await runGit(input.cwd, ["write-tree"], commitEnv);
    const treeOid = treeStdout.trim();

    if (!treeOid) {
      throw new Error("git write-tree returned an empty tree oid.");
    }

    const { stdout: commitStdout } = await runGit(
      input.cwd,
      ["commit-tree", treeOid, "-m", `howcode checkpoint ref=${input.checkpointRef}`],
      commitEnv,
    );
    const commitOid = commitStdout.trim();

    if (!commitOid) {
      throw new Error("git commit-tree returned an empty commit oid.");
    }

    await runGit(input.cwd, ["update-ref", input.checkpointRef, commitOid]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function diffCheckpoints(input: {
  cwd: string;
  fromCheckpointRef: string;
  toCheckpointRef: string;
}) {
  const fromCommitOid = await resolveCheckpointCommit(input.cwd, input.fromCheckpointRef);
  const toCommitOid = await resolveCheckpointCommit(input.cwd, input.toCheckpointRef);

  if (!fromCommitOid || !toCommitOid) {
    throw new Error("Checkpoint ref is unavailable for diff operation.");
  }

  const { stdout } = await runGit(input.cwd, [
    "diff",
    "--patch",
    "--minimal",
    "--no-color",
    fromCommitOid,
    toCommitOid,
  ]);

  return stdout;
}
