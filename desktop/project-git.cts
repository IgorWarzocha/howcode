import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { ProjectDiffResult, ProjectGitState } from "../shared/desktop-contracts.ts";

const execFile = promisify(execFileCallback);

export type CommitMessageContext = {
  projectId: string;
  branch: string | null;
  hasOrigin: boolean;
  includeUnstaged: boolean;
  fileCount: number;
  insertions: number;
  deletions: number;
  nameStatus: string;
  diffStat: string;
  numStat: string;
  patch: string;
};

function parseShortStat(output: string) {
  const insertionsMatch = output.match(/(\d+)\s+insertions?\(\+\)/);
  const deletionsMatch = output.match(/(\d+)\s+deletions?\(-\)/);

  return {
    insertions: insertionsMatch ? Number.parseInt(insertionsMatch[1], 10) : 0,
    deletions: deletionsMatch ? Number.parseInt(deletionsMatch[1], 10) : 0,
  };
}

async function runGit(projectId: string, args: string[]) {
  return runGitWithOptions(projectId, args);
}

async function runGitWithOptions(
  projectId: string,
  args: string[],
  options: {
    env?: NodeJS.ProcessEnv;
    maxBuffer?: number;
    timeout?: number;
  } = {},
) {
  return execFile("git", args, {
    cwd: projectId,
    env: options.env,
    timeout: options.timeout ?? 3_000,
    maxBuffer: options.maxBuffer ?? 1024 * 128,
  });
}

function getNonInteractiveGitEnv(baseEnv?: NodeJS.ProcessEnv) {
  return {
    ...process.env,
    ...baseEnv,
    GIT_TERMINAL_PROMPT: "0",
    GCM_INTERACTIVE: "Never",
    GIT_ASKPASS: "echo",
    SSH_ASKPASS: "echo",
    GIT_SSH_COMMAND: "ssh -oBatchMode=yes -oConnectTimeout=5",
  };
}

function formatGitCommandError(error: unknown) {
  if (!(error instanceof Error)) {
    return "Git command failed.";
  }

  const details = [
    "stdout" in error && typeof error.stdout === "string" ? error.stdout.trim() : "",
    "stderr" in error && typeof error.stderr === "string" ? error.stderr.trim() : "",
    error.message,
  ]
    .find((value) => value.length > 0)
    ?.replace(/\s+/g, " ")
    .trim();

  return details && details.length > 0 ? details : "Git command failed.";
}

async function hasHeadCommit(projectId: string) {
  try {
    await runGit(projectId, ["rev-parse", "--verify", "HEAD"]);
    return true;
  } catch {
    return false;
  }
}

async function withTemporaryIndex<T>(
  projectId: string,
  callback: (context: { env: NodeJS.ProcessEnv; hasHead: boolean }) => Promise<T>,
) {
  const tempDir = await mkdtemp(join(tmpdir(), "howcode-git-index-"));
  const env = { ...process.env, GIT_INDEX_FILE: join(tempDir, "index") };

  try {
    const repositoryHasHead = await hasHeadCommit(projectId);
    if (repositoryHasHead) {
      await runGitWithOptions(projectId, ["read-tree", "HEAD"], {
        env,
        timeout: 10_000,
        maxBuffer: 1024 * 1024,
      });
    }

    return await callback({ env, hasHead: repositoryHasHead });
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

async function isGitRepository(projectId: string) {
  try {
    const { stdout } = await runGit(projectId, ["rev-parse", "--is-inside-work-tree"]);
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}

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

function countNonEmptyLines(output: string) {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean).length;
}

async function getStatusSummary(projectId: string) {
  try {
    const { stdout } = await runGit(projectId, ["status", "--short", "--branch"]);
    return parseStatusSummary(stdout);
  } catch {
    return {
      fileCount: 0,
      stagedFileCount: 0,
      unstagedFileCount: 0,
    };
  }
}

async function getOriginUrl(projectId: string) {
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

  const [branch, stats, statusSummary, originUrl] = await Promise.all([
    getBranch(projectId),
    getDiffStats(projectId),
    getStatusSummary(projectId),
    getOriginUrl(projectId),
  ]);

  return {
    projectId,
    isGitRepo: true,
    branch,
    fileCount: statusSummary.fileCount,
    stagedFileCount: statusSummary.stagedFileCount,
    unstagedFileCount: statusSummary.unstagedFileCount,
    insertions: stats.insertions,
    deletions: stats.deletions,
    hasOrigin: originUrl !== null,
    originName: deriveOriginName(originUrl),
    originUrl,
  };
}

function buildDefaultCommitMessage(context: { fileCount: number }) {
  if (context.fileCount <= 0) {
    return "Update workspace";
  }

  return context.fileCount === 1 ? "Update 1 file" : `Update ${context.fileCount} files`;
}

export async function prepareCommitMessageContext(
  projectId: string,
  includeUnstaged: boolean,
): Promise<CommitMessageContext | null> {
  if (!(await isGitRepository(projectId))) {
    return null;
  }

  const diffArguments = (hasHead: boolean, extraArgs: string[]) => [
    "diff",
    "--cached",
    ...(hasHead ? [] : ["--root"]),
    ...extraArgs,
    "--",
  ];

  const loadContextOutputs = async (options?: { env?: NodeJS.ProcessEnv; hasHead?: boolean }) => {
    const hasHead = options?.hasHead ?? (await hasHeadCommit(projectId));

    const [
      branch,
      originUrl,
      shortStatOutput,
      diffStatOutput,
      nameStatusOutput,
      numStatOutput,
      patchOutput,
    ] = await Promise.all([
      getBranch(projectId),
      getOriginUrl(projectId),
      runGitWithOptions(projectId, diffArguments(hasHead, ["--shortstat"]), {
        env: options?.env,
        timeout: 10_000,
        maxBuffer: 1024 * 1024 * 4,
      }).then(
        ({ stdout }) => stdout.trim(),
        () => "",
      ),
      runGitWithOptions(projectId, diffArguments(hasHead, ["--stat=200,200", "--find-renames"]), {
        env: options?.env,
        timeout: 10_000,
        maxBuffer: 1024 * 1024 * 4,
      }).then(
        ({ stdout }) => stdout.trim(),
        () => "",
      ),
      runGitWithOptions(projectId, diffArguments(hasHead, ["--name-status", "--find-renames"]), {
        env: options?.env,
        timeout: 10_000,
        maxBuffer: 1024 * 1024 * 4,
      }).then(
        ({ stdout }) => stdout.trim(),
        () => "",
      ),
      runGitWithOptions(projectId, diffArguments(hasHead, ["--numstat", "--find-renames"]), {
        env: options?.env,
        timeout: 10_000,
        maxBuffer: 1024 * 1024 * 4,
      }).then(
        ({ stdout }) => stdout.trim(),
        () => "",
      ),
      runGitWithOptions(
        projectId,
        diffArguments(hasHead, ["--unified=1", "--no-color", "--no-ext-diff", "--find-renames"]),
        {
          env: options?.env,
          timeout: 10_000,
          maxBuffer: 1024 * 1024 * 12,
        },
      ).then(
        ({ stdout }) => stdout.trim(),
        () => "",
      ),
    ]);

    return {
      branch,
      originUrl,
      shortStatOutput,
      diffStatOutput,
      nameStatusOutput,
      numStatOutput,
      patchOutput,
    };
  };

  const outputs = includeUnstaged
    ? await withTemporaryIndex(projectId, async ({ env, hasHead }) => {
        await runGitWithOptions(projectId, ["add", "-A", "--", "."], {
          env,
          timeout: 10_000,
          maxBuffer: 1024 * 1024 * 4,
        });
        return loadContextOutputs({ env, hasHead });
      })
    : await loadContextOutputs();

  const {
    branch,
    originUrl,
    shortStatOutput,
    diffStatOutput,
    nameStatusOutput,
    numStatOutput,
    patchOutput,
  } = outputs;

  const shortStat = parseShortStat(shortStatOutput);
  const fileCount = Math.max(
    countNonEmptyLines(nameStatusOutput),
    countNonEmptyLines(numStatOutput),
  );

  if (fileCount <= 0) {
    return null;
  }

  return {
    projectId,
    branch,
    hasOrigin: originUrl !== null,
    includeUnstaged,
    fileCount,
    insertions: shortStat.insertions,
    deletions: shortStat.deletions,
    nameStatus: nameStatusOutput,
    diffStat: diffStatOutput,
    numStat: numStatOutput,
    patch: patchOutput,
  };
}

export async function loadProjectDiff(projectId: string): Promise<ProjectDiffResult | null> {
  const context = await prepareCommitMessageContext(projectId, true);
  if (!context) {
    return null;
  }

  return {
    projectId,
    diff: context.patch,
  };
}

export async function initializeProjectGit(projectId: string) {
  if (await isGitRepository(projectId)) {
    return;
  }

  await runGit(projectId, ["init"]);
}

export async function setProjectOrigin(projectId: string, repoUrl: string) {
  if (!(await isGitRepository(projectId))) {
    return;
  }

  const currentOriginUrl = await getOriginUrl(projectId);

  if (currentOriginUrl) {
    await runGit(projectId, ["remote", "set-url", "origin", repoUrl]);
    return;
  }

  await runGit(projectId, ["remote", "add", "origin", repoUrl]);
}

export async function commitProjectChanges(
  projectId: string,
  options: {
    includeUnstaged: boolean;
    message: string | null;
    push: boolean;
    preview?: boolean;
    generateMessage?: (context: CommitMessageContext) => Promise<string | null | undefined>;
  },
) {
  try {
    const context = await prepareCommitMessageContext(projectId, options.includeUnstaged);
    if (!context) {
      return { committed: false, message: null, previewed: false };
    }

    const generatedMessage = options.message ? null : await options.generateMessage?.(context);
    const commitMessage = options.message ?? generatedMessage ?? buildDefaultCommitMessage(context);

    if (options.preview) {
      return {
        committed: false,
        message: commitMessage,
        previewed: true,
      };
    }

    if (options.includeUnstaged) {
      await runGit(projectId, ["add", "-A"]);
    }

    await runGit(projectId, ["commit", "-m", commitMessage]);

    if (!options.push || !context.hasOrigin || !context.branch) {
      return {
        committed: true,
        message: commitMessage,
        previewed: false,
      };
    }

    try {
      await runGitWithOptions(projectId, ["push", "origin", context.branch], {
        env: getNonInteractiveGitEnv(),
        timeout: 15_000,
        maxBuffer: 1024 * 1024 * 2,
      });
    } catch (pushError) {
      try {
        await runGitWithOptions(projectId, ["push", "--set-upstream", "origin", context.branch], {
          env: getNonInteractiveGitEnv(),
          timeout: 15_000,
          maxBuffer: 1024 * 1024 * 2,
        });
      } catch {
        return {
          committed: true,
          message: commitMessage,
          previewed: false,
          pushFailed: true,
          error: `Committed locally, but push failed: ${formatGitCommandError(pushError)}`,
        };
      }
    }

    return {
      committed: true,
      message: commitMessage,
      previewed: false,
    };
  } catch (error) {
    return {
      committed: false,
      message: null,
      previewed: false,
      error: formatGitCommandError(error),
    };
  }
}
